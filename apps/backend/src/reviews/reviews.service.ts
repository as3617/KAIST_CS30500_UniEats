import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, SortOrder, Types } from "mongoose";
import { AuthenticatedUser, AuthService } from "../auth/auth.service";
import { CafeteriaManager } from "../cafeteria-managers/schemas/cafeteria-manager.schema";
import { Cafeteria } from "../cafeterias/schemas/cafeteria.schema";
import { PaginatedData } from "../common/api-response";
import {
  ManagerPermission,
  ManagerRole,
  MenuServingStatus,
  NotificationResourceType,
  NotificationType,
  ReceiptStatus,
  UserRole,
} from "../common/enums";
import { toObjectId } from "../common/object-id";
import { parsePagination } from "../common/pagination";
import { MenuServing } from "../menu-servings/schemas/menu-serving.schema";
import { NotificationsService } from "../notifications/notifications.service";
import { Receipt } from "../receipts/schemas/receipt.schema";
import { User } from "../users/schemas/user.schema";
import { Review } from "./schemas/review.schema";

const ACTIVE_REVIEW_FILTER = {
  $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
};
const MAX_REVIEW_CONTENT_LENGTH = 2000;
const MAX_REPLY_CONTENT_LENGTH = 2000;

export interface ReviewListQuery {
  page?: string;
  limit?: string;
  sort?: string;
}

export interface ReviewCreateBody {
  receiptId?: unknown;
  rating?: unknown;
  detailRatings?: unknown;
  content?: unknown;
}

export interface ReviewReplyBody {
  content?: unknown;
}

type DetailRatingsInput = {
  taste?: unknown;
  price?: unknown;
  portion?: unknown;
};

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<Review>,
    @InjectModel(Receipt.name)
    private readonly receiptModel: Model<Receipt>,
    @InjectModel(MenuServing.name)
    private readonly menuServingModel: Model<MenuServing>,
    @InjectModel(Cafeteria.name)
    private readonly cafeteriaModel: Model<Cafeteria>,
    @InjectModel(CafeteriaManager.name)
    private readonly cafeteriaManagerModel: Model<CafeteriaManager>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly authService: AuthService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findByMenuServing(
    menuServingId: string,
    query: ReviewListQuery,
  ): Promise<PaginatedData<Record<string, unknown>>> {
    const menuServingObjectId = await this.requireMenuServing(menuServingId);
    const { page, limit, skip } = parsePagination(query as Record<string, unknown>);
    const filter = {
      menuServingId: menuServingObjectId,
      ...ACTIVE_REVIEW_FILTER,
    };

    const [items, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort(this.reviewSort(query.sort))
        .skip(skip)
        .limit(limit)
        .populate({ path: "userId", select: "nickname" })
        .lean()
        .exec(),
      this.reviewModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((review) => this.toPublicReviewResponse(review)),
      page,
      limit,
      total,
    };
  }

  async findMine(
    authorization: string | undefined,
    query: ReviewListQuery,
  ): Promise<PaginatedData<Record<string, unknown>>> {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    const { page, limit, skip } = parsePagination(query as Record<string, unknown>);
    const filter = {
      userId: new Types.ObjectId(currentUser.id),
      ...ACTIVE_REVIEW_FILTER,
    };

    const [items, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort(this.reviewSort(query.sort))
        .skip(skip)
        .limit(limit)
        .populate({ path: "mealId", select: "name" })
        .populate({ path: "cafeteriaId", select: "name" })
        .lean()
        .exec(),
      this.reviewModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((review) => ({
        ...this.toReviewResponse(review),
        mealName: this.populatedName(review.mealId),
        cafeteriaName: this.populatedName(review.cafeteriaId),
      })),
      page,
      limit,
      total,
    };
  }

  async create(
    menuServingId: string,
    authorization: string | undefined,
    body?: ReviewCreateBody,
  ) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    const menuServingObjectId = toObjectId(menuServingId, "menuServingId");
    const serving = await this.menuServingModel.findById(menuServingObjectId).lean().exec();

    if (!serving) {
      throw new NotFoundException("menu serving not found");
    }

    const normalized = this.normalizeCreateBody(body);
    const receiptObjectId = toObjectId(normalized.receiptId, "receiptId");
    await this.validateReceiptForReview(
      receiptObjectId,
      currentUser.id,
      menuServingObjectId,
    );

    const lockResult = await this.receiptModel
      .updateOne(
        {
          _id: receiptObjectId,
          userId: new Types.ObjectId(currentUser.id),
          status: ReceiptStatus.VERIFIED,
          confirmedMenuServingId: menuServingObjectId,
          usedForReview: false,
        },
        {
          $set: {
            status: ReceiptStatus.USED,
            usedForReview: true,
          },
        },
      )
      .exec();

    if (lockResult.modifiedCount !== 1) {
      throw new ConflictException("receipt is not available for review");
    }

    let createdReview: any;
    try {
      createdReview = await this.reviewModel.create({
        userId: new Types.ObjectId(currentUser.id),
        mealId: serving.mealId,
        menuServingId: menuServingObjectId,
        cafeteriaId: serving.cafeteriaId,
        receiptId: receiptObjectId,
        isVerified: true,
        rating: normalized.rating,
        detailRatings: normalized.detailRatings,
        content: normalized.content,
      });

      await this.receiptModel
        .updateOne({ _id: receiptObjectId }, { $set: { reviewId: createdReview._id } })
        .exec();
      await Promise.all([
        this.recalculateMenuServingRating(menuServingObjectId),
        this.recalculateUserReviewStats(new Types.ObjectId(currentUser.id)),
      ]);
    } catch (error) {
      await this.receiptModel
        .updateOne(
          { _id: receiptObjectId, reviewId: { $exists: false } },
          {
            $set: { status: ReceiptStatus.VERIFIED, usedForReview: false },
            $unset: { reviewId: "" },
          },
        )
        .exec();

      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException("receipt already has a review");
      }
      throw error;
    }

    return this.toReviewResponse(createdReview.toObject());
  }

  async delete(reviewId: string, authorization: string | undefined) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    const reviewObjectId = toObjectId(reviewId, "reviewId");
    const review = await this.reviewModel
      .findOne({ _id: reviewObjectId, ...ACTIVE_REVIEW_FILTER })
      .lean()
      .exec();

    if (!review) {
      throw new NotFoundException("review not found");
    }

    const isOwner = review.userId?.toString?.() === currentUser.id;
    if (!isOwner && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException("review owner or admin role required");
    }

    const deletedAt = new Date();
    const updated = await this.reviewModel
      .findOneAndUpdate(
        { _id: reviewObjectId, ...ACTIVE_REVIEW_FILTER },
        {
          $set: {
            deletedAt,
            deletedBy: new Types.ObjectId(currentUser.id),
          },
        },
        { returnDocument: "after", runValidators: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException("review not found");
    }

    await Promise.all([
      this.recalculateMenuServingRating(updated.menuServingId as Types.ObjectId),
      this.recalculateUserReviewStats(updated.userId as Types.ObjectId),
    ]);

    return {
      reviewId: reviewObjectId.toString(),
      deletedAt: deletedAt.toISOString(),
    };
  }

  async reply(reviewId: string, authorization: string | undefined, body?: ReviewReplyBody) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    const reviewObjectId = toObjectId(reviewId, "reviewId");
    const content = this.normalizeReplyBody(body);
    const review = await this.reviewModel
      .findOne({ _id: reviewObjectId, ...ACTIVE_REVIEW_FILTER })
      .lean()
      .exec();

    if (!review) {
      throw new NotFoundException("review not found");
    }

    await this.assertCanReply(currentUser, review.cafeteriaId as Types.ObjectId);

    const now = new Date();
    const hadReply = Boolean(review.managerReply);
    const update: Record<string, unknown> = {
      "managerReply.managerId": new Types.ObjectId(currentUser.id),
      "managerReply.content": content,
      "managerReply.repliedAt": hadReply ? review.managerReply?.repliedAt : now,
    };
    if (hadReply) {
      update["managerReply.updatedAt"] = now;
    }

    const updated = await this.reviewModel
      .findByIdAndUpdate(
        reviewObjectId,
        { $set: update },
        { returnDocument: "after", runValidators: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException("review not found");
    }

    if (!hadReply) {
      await this.notificationsService.createForUser({
        userId: review.userId as Types.ObjectId,
        type: NotificationType.MANAGER_REPLY,
        title: "리뷰에 답변이 등록되었습니다.",
        message: "작성하신 리뷰에 식당 매니저 답변이 등록되었습니다.",
        resourceType: NotificationResourceType.REVIEW,
        resourceId: reviewObjectId,
      });
    }

    return this.toReviewResponse(updated);
  }

  private async validateReceiptForReview(
    receiptId: Types.ObjectId,
    userId: string,
    menuServingId: Types.ObjectId,
  ) {
    const receipt = await this.receiptModel.findById(receiptId).lean().exec();

    if (!receipt || receipt.userId?.toString?.() !== userId) {
      throw new NotFoundException("receipt not found");
    }
    if (receipt.usedForReview) {
      throw new ConflictException("receipt already used for review");
    }
    if (receipt.status !== ReceiptStatus.VERIFIED) {
      throw new BadRequestException("receipt must be verified before writing a review");
    }
    if (receipt.confirmedMenuServingId?.toString?.() !== menuServingId.toString()) {
      throw new BadRequestException("receipt does not match this menu serving");
    }
  }

  private async requireMenuServing(menuServingId: string) {
    const menuServingObjectId = toObjectId(menuServingId, "menuServingId");
    const serving = await this.menuServingModel
      .findOne({ _id: menuServingObjectId, status: { $ne: MenuServingStatus.HIDDEN } })
      .select("_id cafeteriaId")
      .lean()
      .exec();

    if (!serving) {
      throw new NotFoundException("menu serving not found");
    }

    const cafeteria = await this.cafeteriaModel
      .findOne({ _id: serving.cafeteriaId, isActive: true })
      .select("_id")
      .lean()
      .exec();

    if (!cafeteria) {
      throw new NotFoundException("menu serving not found");
    }

    return menuServingObjectId;
  }

  private async assertCanReply(currentUser: AuthenticatedUser, cafeteriaId: Types.ObjectId) {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }
    if (currentUser.role !== UserRole.MANAGER) {
      throw new ForbiddenException("manager role required");
    }

    const manager = await this.cafeteriaManagerModel
      .findOne({
        userId: new Types.ObjectId(currentUser.id),
        cafeteriaId,
        isActive: true,
        $or: [
          { managerRole: ManagerRole.OWNER },
          { permissions: ManagerPermission.REVIEW_REPLY },
        ],
      })
      .select("_id")
      .lean()
      .exec();

    if (!manager) {
      throw new ForbiddenException("review reply permission required");
    }
  }

  private async recalculateMenuServingRating(menuServingId: Types.ObjectId) {
    const [stats] = await this.reviewModel
      .aggregate([
        {
          $match: {
            menuServingId,
            isVerified: true,
            ...ACTIVE_REVIEW_FILTER,
          },
        },
        {
          $group: {
            _id: "$menuServingId",
            averageRating: { $avg: "$rating" },
            verifiedReviewCount: { $sum: 1 },
          },
        },
      ])
      .exec();

    await this.menuServingModel
      .updateOne(
        { _id: menuServingId },
        {
          $set: {
            averageRating: stats?.averageRating ?? 0,
            verifiedReviewCount: stats?.verifiedReviewCount ?? 0,
          },
        },
      )
      .exec();
  }

  private async recalculateUserReviewStats(userId: Types.ObjectId) {
    const verifiedReviewCount = await this.reviewModel
      .countDocuments({
        userId,
        isVerified: true,
        ...ACTIVE_REVIEW_FILTER,
      })
      .exec();

    await this.userModel
      .updateOne(
        { _id: userId },
        { $set: { "reviewStats.verifiedReviewCount": verifiedReviewCount } },
      )
      .exec();
  }

  private normalizeCreateBody(body?: ReviewCreateBody) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("request body is required");
    }

    return {
      receiptId: this.requiredString(body.receiptId, "receiptId"),
      rating: this.normalizeRating(body.rating, "rating"),
      detailRatings: this.normalizeDetailRatings(body.detailRatings),
      content: this.normalizeOptionalString(
        body.content,
        "content",
        MAX_REVIEW_CONTENT_LENGTH,
      ),
    };
  }

  private normalizeReplyBody(body?: ReviewReplyBody) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("request body is required");
    }

    return this.normalizeRequiredString(body.content, "content", MAX_REPLY_CONTENT_LENGTH);
  }

  private normalizeDetailRatings(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("detailRatings must be an object");
    }

    const detailRatings = value as DetailRatingsInput;
    return {
      taste: this.normalizeRating(detailRatings.taste, "detailRatings.taste"),
      price: this.normalizeRating(detailRatings.price, "detailRatings.price"),
      portion: this.normalizeRating(detailRatings.portion, "detailRatings.portion"),
    };
  }

  private normalizeRating(value: unknown, fieldName: string) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
      throw new BadRequestException(`${fieldName} must be an integer between 1 and 5`);
    }
    return value;
  }

  private normalizeRequiredString(value: unknown, fieldName: string, maxLength: number) {
    const normalized = this.normalizeOptionalString(value, fieldName, maxLength);
    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return normalized;
  }

  private normalizeOptionalString(value: unknown, fieldName: string, maxLength: number) {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "string") {
      throw new BadRequestException(`${fieldName} must be a string`);
    }

    const normalized = value.trim();
    if (normalized.length > maxLength) {
      throw new BadRequestException(`${fieldName} must be at most ${maxLength} characters`);
    }

    return normalized || undefined;
  }

  private requiredString(value: unknown, fieldName: string) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return value.trim();
  }

  private reviewSort(sort?: string): Record<string, SortOrder> {
    if (!sort || sort === "latest") {
      return { createdAt: -1 as SortOrder };
    }
    if (sort === "oldest") {
      return { createdAt: 1 as SortOrder };
    }
    if (sort === "rating") {
      return { rating: -1 as SortOrder, createdAt: -1 as SortOrder };
    }
    throw new BadRequestException("sort contains invalid value");
  }

  private toReviewResponse(review: any) {
    return {
      id: review._id.toString(),
      userId: this.objectIdToString(review.userId),
      mealId: this.objectIdToString(review.mealId),
      menuServingId: this.objectIdToString(review.menuServingId),
      cafeteriaId: this.objectIdToString(review.cafeteriaId),
      receiptId: this.objectIdToString(review.receiptId),
      isVerified: review.isVerified,
      rating: review.rating,
      detailRatings: {
        taste: review.detailRatings?.taste,
        price: review.detailRatings?.price,
        portion: review.detailRatings?.portion,
      },
      content: review.content,
      managerReply: this.toManagerReplyResponse(review.managerReply),
      createdAt: this.dateToIsoString(review.createdAt),
    };
  }

  private toPublicReviewResponse(review: any) {
    return {
      id: review._id.toString(),
      reviewerDisplayName: this.maskDisplayName(this.populatedNickname(review.userId)),
      mealId: this.objectIdToString(review.mealId),
      menuServingId: this.objectIdToString(review.menuServingId),
      cafeteriaId: this.objectIdToString(review.cafeteriaId),
      isVerified: review.isVerified,
      rating: review.rating,
      detailRatings: {
        taste: review.detailRatings?.taste,
        price: review.detailRatings?.price,
        portion: review.detailRatings?.portion,
      },
      content: review.content,
      managerReply: this.toPublicManagerReplyResponse(review.managerReply),
      createdAt: this.dateToIsoString(review.createdAt),
    };
  }

  private toManagerReplyResponse(reply: any) {
    if (!reply) {
      return undefined;
    }

    return {
      managerId: this.objectIdToString(reply.managerId),
      content: reply.content,
      repliedAt: this.dateToIsoString(reply.repliedAt),
      updatedAt: reply.updatedAt ? this.dateToIsoString(reply.updatedAt) : undefined,
    };
  }

  private toPublicManagerReplyResponse(reply: any) {
    if (!reply) {
      return undefined;
    }

    return {
      content: reply.content,
      repliedAt: this.dateToIsoString(reply.repliedAt),
      updatedAt: reply.updatedAt ? this.dateToIsoString(reply.updatedAt) : undefined,
    };
  }

  private objectIdToString(value: any) {
    if (!value) {
      return undefined;
    }
    if (value instanceof Types.ObjectId) {
      return value.toString();
    }
    if (value._id) {
      return value._id.toString();
    }
    return value.toString();
  }

  private populatedName(value: any) {
    if (!value || value instanceof Types.ObjectId) {
      return value?.toString?.();
    }
    return value.name ?? value._id?.toString?.();
  }

  private populatedNickname(value: any): string | undefined {
    if (!value || value instanceof Types.ObjectId) {
      return undefined;
    }
    return typeof value.nickname === "string" ? value.nickname : undefined;
  }

  private maskDisplayName(value?: string) {
    const chars = Array.from(value?.trim() || "Reviewer");
    if (chars.length === 1) {
      return `${chars[0]}*`;
    }
    if (chars.length === 2) {
      return `${chars[0]}*`;
    }
    return `${chars[0]}${"*".repeat(Math.min(chars.length - 2, 3))}${chars[chars.length - 1]}`;
  }

  private dateToIsoString(value: unknown) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "string") {
      return new Date(value).toISOString();
    }
    return new Date().toISOString();
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === 11000
    );
  }
}
