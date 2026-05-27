import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  ALLERGY_CODES,
  DIETARY_LABEL_CODES,
  AllergyCode,
  DietaryLabelCode,
} from "../common/enums";
import { User } from "./schemas/user.schema";

const MAX_INGREDIENT_PREFERENCE_COUNT = 50;
const MAX_INGREDIENT_PREFERENCE_LENGTH = 64;

export interface UpdateMeBody {
  nickname?: unknown;
  dietaryProfile?: unknown;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async findMe(userId: string) {
    const user = await this.userModel.findById(userId).lean().exec();

    if (!user) {
      throw new NotFoundException("user not found");
    }

    return this.toProfileResponse(user);
  }

  async updateMe(userId: string, body?: UpdateMeBody) {
    const update = this.buildProfileUpdate(body);
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: update },
        { returnDocument: "after", runValidators: true },
      )
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException("user not found");
    }

    return this.toProfileResponse(user);
  }

  private buildProfileUpdate(body?: UpdateMeBody): Record<string, unknown> {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("request body is required");
    }

    const update: Record<string, unknown> = {};

    if ("nickname" in body) {
      update.nickname = this.normalizeNickname(body.nickname);
    }

    if ("dietaryProfile" in body) {
      Object.assign(update, this.normalizeDietaryProfile(body.dietaryProfile));
    }

    if (Object.keys(update).length === 0) {
      throw new BadRequestException("no updatable fields provided");
    }

    return update;
  }

  private normalizeNickname(value: unknown): string {
    if (typeof value !== "string") {
      throw new BadRequestException("nickname must be a string");
    }

    const nickname = value.trim();
    if (nickname.length < 2 || nickname.length > 24) {
      throw new BadRequestException("nickname must be between 2 and 24 characters");
    }

    return nickname;
  }

  private normalizeDietaryProfile(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("dietaryProfile must be an object");
    }

    const profile = value as Record<string, unknown>;
    const update: Record<string, unknown> = {};

    if ("allergies" in profile) {
      update["dietaryProfile.allergies"] = this.normalizeEnumArray<AllergyCode>(
        profile.allergies,
        ALLERGY_CODES,
        "dietaryProfile.allergies",
        ALLERGY_CODES.length,
      );
    }

    if ("preferredIngredients" in profile) {
      update["dietaryProfile.preferredIngredients"] = this.normalizeStringArray(
        profile.preferredIngredients,
        "dietaryProfile.preferredIngredients",
      );
    }

    if ("dislikedIngredients" in profile) {
      update["dietaryProfile.dislikedIngredients"] = this.normalizeStringArray(
        profile.dislikedIngredients,
        "dietaryProfile.dislikedIngredients",
      );
    }

    if ("dietaryLabels" in profile) {
      update["dietaryProfile.dietaryLabels"] = this.normalizeEnumArray<DietaryLabelCode>(
        profile.dietaryLabels,
        DIETARY_LABEL_CODES,
        "dietaryProfile.dietaryLabels",
        DIETARY_LABEL_CODES.length,
      );
    }

    if (Object.keys(update).length === 0) {
      throw new BadRequestException("dietaryProfile has no updatable fields");
    }

    return update;
  }

  private normalizeStringArray(value: unknown, fieldName: string): string[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException(`${fieldName} must be an array`);
    }

    if (value.length > MAX_INGREDIENT_PREFERENCE_COUNT) {
      throw new BadRequestException(
        `${fieldName} must contain at most ${MAX_INGREDIENT_PREFERENCE_COUNT} items`,
      );
    }

    const normalized = value.map((item) => {
      if (typeof item !== "string") {
        throw new BadRequestException(`${fieldName} must contain only strings`);
      }
      const trimmed = item.trim();
      if (trimmed.length > MAX_INGREDIENT_PREFERENCE_LENGTH) {
        throw new BadRequestException(
          `${fieldName} items must be at most ${MAX_INGREDIENT_PREFERENCE_LENGTH} characters`,
        );
      }
      return trimmed;
    });

    return [...new Set(normalized.filter(Boolean))];
  }

  private normalizeEnumArray<T extends string>(
    value: unknown,
    allowedValues: readonly string[],
    fieldName: string,
    maxItems: number,
  ): T[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException(`${fieldName} must be an array`);
    }

    if (value.length > maxItems) {
      throw new BadRequestException(`${fieldName} must contain at most ${maxItems} items`);
    }

    const allowed = new Set<string>(allowedValues);
    const normalized: T[] = [];

    for (const item of value) {
      if (typeof item !== "string" || !allowed.has(item)) {
        throw new BadRequestException(`${fieldName} contains invalid value`);
      }
      if (!normalized.includes(item as T)) {
        normalized.push(item as T);
      }
    }

    return normalized;
  }

  private toProfileResponse(user: any) {
    const dietaryProfile = user.dietaryProfile ?? {};
    const reviewStats = user.reviewStats ?? {};

    return {
      id: user._id.toString(),
      email: user.email,
      nickname: user.nickname,
      role: user.role,
      dietaryProfile: {
        allergies: dietaryProfile.allergies ?? [],
        preferredIngredients: dietaryProfile.preferredIngredients ?? [],
        dislikedIngredients: dietaryProfile.dislikedIngredients ?? [],
        dietaryLabels: dietaryProfile.dietaryLabels ?? [],
      },
      reviewStats: {
        verifiedReviewCount: reviewStats.verifiedReviewCount ?? 0,
      },
    };
  }
}
