/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuthService } from "../auth/auth.service";
import { MenuServingStatus } from "../common/enums";
import { parsePositiveInt } from "../common/pagination";
import { Review } from "../reviews/schemas/review.schema";
import { User } from "../users/schemas/user.schema";

const DEFAULT_INSIGHT_LIMIT = 5;
const MAX_INSIGHT_LIMIT = 20;
const DEFAULT_WINDOW_DAYS = 7;
const POSITIVE_RATING_THRESHOLD = 3;
const REVIEW_WEIGHT_CAP = 50;
const PREFERRED_INGREDIENT_MATCH_CAP = 3;
const DISLIKED_INGREDIENT_MATCH_CAP = 3;
const PREFERRED_INGREDIENT_SCORE_BOOST = 0.15;
const DISLIKED_INGREDIENT_SCORE_PENALTY = 0.25;
const MIN_PERSONALIZED_SCORE_MULTIPLIER = 0.1;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVE_REVIEW_FILTER = {
  $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
};

type DateRange = {
  from: Date;
  toExclusive: Date;
};

type PersonalizationProfile = {
  preferredIngredients: string[];
  dislikedIngredients: string[];
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<Review>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly authService: AuthService,
  ) {}

  async weeklyBest(query: Record<string, unknown>, authorization?: string) {
    const limit = this.parseLimit(query.limit);
    const dateRange = this.parseDateRange(query);
    const personalizationProfile = await this.resolvePersonalizationProfile(authorization);
    const shouldPersonalize = this.hasPersonalizationPreferences(personalizationProfile);

    const pipeline: any[] = [
      { $match: this.buildReviewMatch(dateRange) },
      {
        $group: {
          _id: "$menuServingId",
          averageRating: { $avg: "$rating" },
          verifiedReviewCount: { $sum: 1 },
          positiveReviewCount: {
            $sum: {
              $cond: [{ $gte: ["$rating", POSITIVE_RATING_THRESHOLD] }, 1, 0],
            },
          },
        },
      },
      { $match: { positiveReviewCount: { $gt: 0 } } },
      { $addFields: { cappedPositiveReviewCount: this.cappedPositiveReviewCountExpression() } },
      { $addFields: { score: this.scoreExpression() } },
      {
        $lookup: {
          from: "menu_servings",
          localField: "_id",
          foreignField: "_id",
          as: "serving",
        },
      },
      { $unwind: "$serving" },
      { $match: { "serving.status": { $ne: MenuServingStatus.HIDDEN } } },
      {
        $lookup: {
          from: "meals",
          localField: "serving.mealId",
          foreignField: "_id",
          as: "meal",
        },
      },
      { $unwind: { path: "$meal", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "cafeterias",
          localField: "serving.cafeteriaId",
          foreignField: "_id",
          as: "cafeteria",
        },
      },
      { $unwind: { path: "$cafeteria", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          "cafeteria._id": { $exists: true },
          "cafeteria.isActive": { $ne: false },
        },
      },
      {
        $sort: {
          score: -1,
          averageRating: -1,
          cappedPositiveReviewCount: -1,
          _id: 1,
        },
      },
    ];

    if (!shouldPersonalize) {
      pipeline.push({ $limit: limit });
    }

    const result: any[] = await this.reviewModel.aggregate(pipeline);

    return result
      .map((item) =>
        this.toWeeklyBestItem(item, shouldPersonalize ? personalizationProfile : null),
      )
      .sort((a, b) => {
        if (b.sortScore !== a.sortScore) {
          return b.sortScore - a.sortScore;
        }
        if (b.averageRating !== a.averageRating) {
          return b.averageRating - a.averageRating;
        }
        if (b.cappedPositiveReviewCount !== a.cappedPositiveReviewCount) {
          return b.cappedPositiveReviewCount - a.cappedPositiveReviewCount;
        }
        return a.menuServingId.localeCompare(b.menuServingId);
      })
      .slice(0, limit)
      .map(({ sortScore, cappedPositiveReviewCount, ...item }) => item);
  }

  async cafeteriaRanking(query: Record<string, unknown>) {
    const limit = this.parseLimit(query.limit);
    const dateRange = this.parseDateRange(query);

    const result: any[] = await this.reviewModel.aggregate([
      { $match: this.buildReviewMatch(dateRange) },
      {
        $group: {
          _id: "$cafeteriaId",
          averageRating: { $avg: "$rating" },
          verifiedReviewCount: { $sum: 1 },
          positiveReviewCount: {
            $sum: {
              $cond: [{ $gte: ["$rating", POSITIVE_RATING_THRESHOLD] }, 1, 0],
            },
          },
        },
      },
      { $match: { positiveReviewCount: { $gt: 0 } } },
      { $addFields: { cappedPositiveReviewCount: this.cappedPositiveReviewCountExpression() } },
      { $addFields: { score: this.scoreExpression() } },
      {
        $lookup: {
          from: "cafeterias",
          localField: "_id",
          foreignField: "_id",
          as: "cafeteria",
        },
      },
      { $unwind: "$cafeteria" },
      { $match: { "cafeteria.isActive": { $ne: false } } },
      {
        $sort: {
          score: -1,
          averageRating: -1,
          cappedPositiveReviewCount: -1,
          _id: 1,
        },
      },
      { $limit: limit },
    ]);

    return result.map((item, index) => ({
      cafeteriaId: String(item._id),
      cafeteriaName: item.cafeteria?.name ?? "",
      averageRating: this.roundRating(item.averageRating),
      verifiedReviewCount: item.verifiedReviewCount,
      positiveReviewCount: item.positiveReviewCount,
      rank: index + 1,
    }));
  }

  private buildReviewMatch(dateRange: DateRange) {
    return {
      isVerified: true,
      createdAt: {
        $gte: dateRange.from,
        $lt: dateRange.toExclusive,
      },
      ...ACTIVE_REVIEW_FILTER,
    };
  }

  private scoreExpression() {
    return {
      $multiply: [
        "$averageRating",
        {
          $ln: {
            $add: ["$cappedPositiveReviewCount", 1],
          },
        },
      ],
    };
  }

  private cappedPositiveReviewCountExpression() {
    return { $min: ["$positiveReviewCount", REVIEW_WEIGHT_CAP] };
  }

  private hasPersonalizationPreferences(profile: PersonalizationProfile | null) {
    return Boolean(
      profile &&
        (profile.preferredIngredients.length > 0 || profile.dislikedIngredients.length > 0),
    );
  }

  private toWeeklyBestItem(item: any, profile: PersonalizationProfile | null) {
    const baseScore = item.score ?? 0;
    const sortScore = profile
      ? this.applyPersonalizationScore(baseScore, item.meal?.ingredients, profile)
      : baseScore;

    return {
      menuServingId: String(item._id),
      mealName: item.meal?.name ?? "",
      cafeteriaName: item.cafeteria?.name ?? "",
      averageRating: this.roundRating(item.averageRating),
      verifiedReviewCount: item.verifiedReviewCount,
      positiveReviewCount: item.positiveReviewCount,
      score: this.roundScore(sortScore),
      sortScore,
      cappedPositiveReviewCount: item.cappedPositiveReviewCount ?? 0,
    };
  }

  private applyPersonalizationScore(
    baseScore: number,
    ingredients: unknown,
    profile: PersonalizationProfile,
  ) {
    const normalizedIngredients = this.normalizeIngredientList(ingredients);
    if (normalizedIngredients.length === 0) {
      return baseScore;
    }

    const preferredMatches = this.countPreferenceMatches(
      normalizedIngredients,
      profile.preferredIngredients,
    );
    const dislikedMatches = this.countPreferenceMatches(
      normalizedIngredients,
      profile.dislikedIngredients,
    );
    const multiplier = Math.max(
      MIN_PERSONALIZED_SCORE_MULTIPLIER,
      1 +
        Math.min(preferredMatches, PREFERRED_INGREDIENT_MATCH_CAP) *
          PREFERRED_INGREDIENT_SCORE_BOOST -
        Math.min(dislikedMatches, DISLIKED_INGREDIENT_MATCH_CAP) *
          DISLIKED_INGREDIENT_SCORE_PENALTY,
    );

    return baseScore * multiplier;
  }

  private countPreferenceMatches(
    normalizedIngredients: string[],
    normalizedPreferences: string[],
  ) {
    if (normalizedPreferences.length === 0) {
      return 0;
    }

    return normalizedPreferences.filter((preference) =>
      normalizedIngredients.some((ingredient) =>
        this.ingredientsMatchPreference(ingredient, preference),
      ),
    ).length;
  }

  private ingredientsMatchPreference(ingredient: string, preference: string) {
    if (!ingredient || !preference) {
      return false;
    }

    if (ingredient === preference) {
      return true;
    }

    const escaped = this.escapeRegExp(preference);
    return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(ingredient);
  }

  private async resolvePersonalizationProfile(
    authorization?: string,
  ): Promise<PersonalizationProfile | null> {
    if (!authorization?.trim()) {
      return null;
    }

    let currentUser: { id: string };
    try {
      currentUser = await this.authService.requireUser(authorization);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return null;
      }
      throw error;
    }

    const user = await this.userModel
      .findById(currentUser.id)
      .select("dietaryProfile.preferredIngredients dietaryProfile.dislikedIngredients")
      .lean()
      .exec();
    const dietaryProfile = (user?.dietaryProfile ?? {}) as Partial<PersonalizationProfile>;

    return {
      preferredIngredients: this.normalizeIngredientList(
        dietaryProfile.preferredIngredients,
      ),
      dislikedIngredients: this.normalizeIngredientList(
        dietaryProfile.dislikedIngredients,
      ),
    };
  }

  private normalizeIngredientList(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return [
      ...new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => this.normalizeIngredientText(item))
          .filter(Boolean),
      ),
    ];
  }

  private normalizeIngredientText(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private parseLimit(value: unknown) {
    return Math.min(parsePositiveInt(value, DEFAULT_INSIGHT_LIMIT), MAX_INSIGHT_LIMIT);
  }

  private parseDateRange(query: Record<string, unknown>): DateRange {
    const fromInput = this.firstString(query.from);
    const toInput = this.firstString(query.to);
    const toDate = toInput ? this.parseDateOnly(toInput, "to") : this.todayInSeoul();
    const fromDate = fromInput
      ? this.parseDateOnly(fromInput, "from")
      : this.addDays(toDate, -(DEFAULT_WINDOW_DAYS - 1));

    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException("from must be before or equal to to");
    }

    return {
      from: this.seoulDateStartUtc(fromDate),
      toExclusive: this.seoulDateStartUtc(this.addDays(toDate, 1)),
    };
  }

  private firstString(value: unknown) {
    const raw = Array.isArray(value) ? value[0] : value;
    return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  }

  private parseDateOnly(value: string, fieldName: string) {
    if (!DATE_PATTERN.test(value)) {
      throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format`);
    }

    const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${fieldName} must be a valid calendar date`);
    }
    return date;
  }

  private todayInSeoul() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return this.parseDateOnly(`${values.year}-${values.month}-${values.day}`, "to");
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date.getTime());
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private seoulDateStartUtc(date: Date) {
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - 1,
      15,
      0,
      0,
      0,
    ));
  }

  private roundRating(value: number) {
    return Math.round((value ?? 0) * 10) / 10;
  }

  private roundScore(value: number) {
    return Math.round((value ?? 0) * 100) / 100;
  }
}
