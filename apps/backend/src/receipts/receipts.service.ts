import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { timingSafeEqual } from "crypto";
import { Model, Types } from "mongoose";
import { AuthService } from "../auth/auth.service";
import {
  MenuServingStatus,
  NotificationResourceType,
  NotificationType,
  ReceiptStatus,
} from "../common/enums";
import { toObjectId } from "../common/object-id";
import { MenuServing } from "../menu-servings/schemas/menu-serving.schema";
import { NotificationsService } from "../notifications/notifications.service";
import { Receipt } from "./schemas/receipt.schema";
import { OCR_CLIENT, OcrClient } from "./ocr-clients/ocr-client.interface";
import { extractDate, matchMenu, extractApprovalNumber } from "./ocr-parser.util";

const MAX_FAKE_OCR_MATCHES = 8;
const MAX_REJECT_REASON_LENGTH = 500;

export type ReceiptUploadFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

export interface ReceiptConfirmBody {
  confirmedMenuServingId?: unknown;
  menuServingId?: unknown;
}

@Injectable()
export class ReceiptsService {
  constructor(
    @InjectModel(Receipt.name)
    private readonly receiptModel: Model<Receipt>,
    @InjectModel(MenuServing.name)
    private readonly menuServingModel: Model<MenuServing>,
    private readonly authService: AuthService,
    @Inject(OCR_CLIENT) private readonly ocrClient: OcrClient,
    private readonly notificationsService: NotificationsService,
  ) {}

  async upload(authorization: string | undefined, file?: ReceiptUploadFile) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    this.validateUploadFile(file);

    const receipt = await this.receiptModel.create({
      userId: new Types.ObjectId(currentUser.id),
      imageUrl: this.buildPrivateImageKey(currentUser.id, file?.originalname),
      ocrProvider: this.ocrClient.provider,
      status: ReceiptStatus.OCR_PROCESSING,
      usedForReview: false,
    } as any);

    if (file?.buffer) {
      void this.ocrClient.processReceiptAsync(receipt._id.toString(), file).catch(async (error) => {
        console.error("Failed to trigger OCR service", error);
        try {
          const rejected = await this.markOcrRejected(
            receipt._id as Types.ObjectId,
            "OCR service could not be started. Please try again later.",
          );
          await this.notifyReceiptStatusUpdated(rejected);
        } catch (updateError) {
          console.error("Failed to mark receipt as rejected after OCR dispatch failure", updateError);
        }
      });
    }

    return this.toReceiptResponse((receipt as any).toObject(), []);
  }

  async handleWebhook(
    webhookSecret: string | undefined,
    receiptId: unknown,
    rawText?: unknown,
    error?: unknown,
  ) {
    this.assertWebhookSecret(webhookSecret);
    const receiptObjectId = toObjectId(this.requiredString(receiptId, "receiptId"), "receiptId");

    if (error) {
      const rejected = await this.markOcrRejected(
        receiptObjectId,
        this.normalizeRejectReason(error),
      );
      await this.notifyReceiptStatusUpdated(rejected);
      return;
    }

    const text = typeof rawText === "string" ? rawText : "";
    const extractedDate = extractDate(text);
    const approvalNumber = extractApprovalNumber(text);

    // Duplicate Check
    if (approvalNumber) {
      const isDuplicate = await this.receiptModel.exists({
        "parsed.approvalNumber": approvalNumber,
        usedForReview: true,
      });

      if (isDuplicate) {
        const rejected = await this.markOcrRejected(
          receiptObjectId,
          "This receipt has already been used for a review.",
        );
        await this.notifyReceiptStatusUpdated(rejected);
        return;
      }
    }

    let parsed: any = {};
    if (approvalNumber) {
      parsed.approvalNumber = approvalNumber;
    }
    let matchedMenuServingIds: Types.ObjectId[] = [];

    const result = await this.matchReceiptToServing(text, extractedDate);

    if (result) {
      const { match } = result;
      parsed = {
        ...parsed,
        purchasedAt: new Date(extractedDate ?? match.date),
        cafeteriaName: this.populatedName(match.cafeteriaId),
        mealNames: [this.populatedName(match.mealId)],
        totalPrice: match.price,
      };
      matchedMenuServingIds = [match._id as Types.ObjectId];
    }

    if (matchedMenuServingIds.length === 0) {
      const rejected = await this.markOcrRejectedWithResult(
        receiptObjectId,
        text,
        parsed,
        "OCR result could not be matched to a menu serving.",
      );
      await this.notifyReceiptStatusUpdated(rejected);
      return;
    }

    const updated = await this.receiptModel
      .findOneAndUpdate(
        { _id: receiptObjectId, status: ReceiptStatus.OCR_PROCESSING },
        {
          $set: {
            ocrRawText: text,
            parsed,
            matchedMenuServingIds,
            status: ReceiptStatus.NEED_CONFIRMATION,
          },
        },
        { returnDocument: "after", runValidators: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException("processable receipt not found");
    }

    await this.notifyReceiptStatusUpdated(updated);
  }

  async findById(receiptId: string, authorization: string | undefined) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    const receiptObjectId = toObjectId(receiptId, "receiptId");
    const receipt = await this.receiptModel.findById(receiptObjectId).lean().exec();

    if (!receipt || receipt.userId?.toString?.() !== currentUser.id) {
      throw new NotFoundException("receipt not found");
    }

    return this.toReceiptResponse(receipt, await this.findMatchedServings(receipt));
  }

  async confirm(
    receiptId: string,
    authorization: string | undefined,
    body?: ReceiptConfirmBody,
  ) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    const receiptObjectId = toObjectId(receiptId, "receiptId");
    const confirmedMenuServingId = toObjectId(
      this.requiredString(
        body?.confirmedMenuServingId ?? body?.menuServingId,
        "confirmedMenuServingId",
      ),
      "confirmedMenuServingId",
    );

    const receipt = await this.receiptModel.findById(receiptObjectId).lean().exec();
    if (!receipt || receipt.userId?.toString?.() !== currentUser.id) {
      throw new NotFoundException("receipt not found");
    }
    if (receipt.usedForReview) {
      throw new BadRequestException("receipt is already used for review");
    }
    if (receipt.status !== ReceiptStatus.NEED_CONFIRMATION) {
      throw new BadRequestException("receipt is not pending confirmation");
    }
    if (!this.containsObjectId(receipt.matchedMenuServingIds, confirmedMenuServingId)) {
      throw new BadRequestException("confirmedMenuServingId must be one of matched menu servings");
    }

    const updated = await this.receiptModel
      .findOneAndUpdate(
        {
          _id: receiptObjectId,
          userId: new Types.ObjectId(currentUser.id),
          status: ReceiptStatus.NEED_CONFIRMATION,
          usedForReview: false,
          matchedMenuServingIds: confirmedMenuServingId,
        },
        {
          $set: {
            status: ReceiptStatus.VERIFIED,
            confirmedMenuServingId,
          },
        },
        { returnDocument: "after", runValidators: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new ForbiddenException("receipt cannot be confirmed");
    }

    await Promise.all([
      this.notifyReceiptStatusUpdated(updated),
      this.notifyReviewAvailable(updated),
    ]);

    return this.toReceiptResponse(updated, await this.findMatchedServings(updated));
  }

  private validateUploadFile(file?: ReceiptUploadFile) {
    if (!file) {
      throw new BadRequestException("image file is required");
    }
    if (!file.mimetype?.startsWith("image/")) {
      throw new BadRequestException("image file must use an image content type");
    }
  }

  private assertWebhookSecret(webhookSecret?: string) {
    const expectedSecret = process.env.OCR_WEBHOOK_SECRET;
    if (!expectedSecret) {
      throw new InternalServerErrorException("OCR webhook secret is not configured");
    }
    if (!webhookSecret || !this.secureEquals(webhookSecret, expectedSecret)) {
      throw new UnauthorizedException("invalid OCR webhook secret");
    }
  }

  private secureEquals(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private async markOcrRejected(receiptId: Types.ObjectId, reason: string) {
    const updated = await this.receiptModel
      .findOneAndUpdate(
        { _id: receiptId, status: ReceiptStatus.OCR_PROCESSING },
        {
          $set: {
            status: ReceiptStatus.REJECTED,
            rejectReason: reason,
          },
        },
        { returnDocument: "after", runValidators: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException("processable receipt not found");
    }

    return updated;
  }

  private async notifyReceiptStatusUpdated(receipt: any) {
    await this.notificationsService.createForUser({
      userId: receipt.userId as Types.ObjectId,
      type: NotificationType.RECEIPT_STATUS_UPDATED,
      title: this.receiptStatusTitle(receipt.status),
      message: this.receiptStatusMessage(receipt.status),
      resourceType: NotificationResourceType.RECEIPT,
      resourceId: receipt._id as Types.ObjectId,
    });
  }

  private async notifyReviewAvailable(receipt: any) {
    await this.notificationsService.createForUser({
      userId: receipt.userId as Types.ObjectId,
      type: NotificationType.REVIEW_AVAILABLE,
      title: "리뷰를 작성할 수 있습니다.",
      message: "영수증이 확인되어 리뷰 작성이 가능해졌습니다.",
      resourceType: NotificationResourceType.RECEIPT,
      resourceId: receipt._id as Types.ObjectId,
    });
  }

  private receiptStatusTitle(status: ReceiptStatus) {
    switch (status) {
      case ReceiptStatus.REJECTED:
        return "영수증 OCR 처리가 실패했습니다.";
      case ReceiptStatus.NEED_CONFIRMATION:
        return "영수증 확인이 필요합니다.";
      case ReceiptStatus.VERIFIED:
        return "영수증이 확인되었습니다.";
      default:
        return "영수증 상태가 업데이트되었습니다.";
    }
  }

  private receiptStatusMessage(status: ReceiptStatus) {
    switch (status) {
      case ReceiptStatus.REJECTED:
        return "영수증을 확인할 수 없어 리뷰 작성이 제한되었습니다.";
      case ReceiptStatus.NEED_CONFIRMATION:
        return "OCR 처리가 완료되었습니다. 구매한 메뉴를 확인해 주세요.";
      case ReceiptStatus.VERIFIED:
        return "영수증 확인이 완료되었습니다.";
      default:
        return "영수증 처리 상태가 변경되었습니다.";
    }
  }

  private async markOcrRejectedWithResult(
    receiptId: Types.ObjectId,
    ocrRawText: string,
    parsed: Record<string, unknown>,
    reason: string,
  ) {
    const updated = await this.receiptModel
      .findOneAndUpdate(
        { _id: receiptId, status: ReceiptStatus.OCR_PROCESSING },
        {
          $set: {
            ocrRawText,
            parsed,
            matchedMenuServingIds: [],
            status: ReceiptStatus.REJECTED,
            rejectReason: reason,
          },
        },
        { returnDocument: "after", runValidators: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException("processable receipt not found");
    }

    return updated;
  }

  private normalizeRejectReason(value: unknown) {
    if (typeof value !== "string" || !value.trim()) {
      return "OCR processing failed";
    }
    return value.trim().slice(0, MAX_REJECT_REASON_LENGTH);
  }

  private async matchReceiptToServing(rawText: string, extractedDate: string | null) {
    if (extractedDate) {
      const sameDateServings = await this.findServingsByDate(extractedDate);
      const sameDateMatch = matchMenu(rawText, sameDateServings, 0.7);
      if (sameDateMatch) {
        return sameDateMatch;
      }
    }

    const fallbackServings = await this.findOcrFallbackServings(extractedDate);
    return matchMenu(rawText, fallbackServings, 0.82);
  }

  private async findFakeOcrMatches() {
    const today = todayInSeoul();
    let matches = await this.findServingsByDate(today, MAX_FAKE_OCR_MATCHES);
    if (matches.length === 0) {
      matches = await this.findRecentServings();
    }
    return matches;
  }

  private findServingsByDate(date: string, limit?: number) {
    const query = this.menuServingModel
      .find({ date, status: { $ne: MenuServingStatus.HIDDEN } })
      .sort({ mealTime: 1, cafeteriaId: 1 })
      .populate({ path: "mealId", select: "name" })
      .populate({ path: "cafeteriaId", select: "name" })
      .lean();

    if (limit) {
      query.limit(limit);
    }

    return query.exec();
  }

  private findRecentServings() {
    return this.menuServingModel
      .find({ status: { $ne: MenuServingStatus.HIDDEN } })
      .sort({ date: -1, mealTime: 1, cafeteriaId: 1 })
      .limit(MAX_FAKE_OCR_MATCHES)
      .populate({ path: "mealId", select: "name" })
      .populate({ path: "cafeteriaId", select: "name" })
      .lean()
      .exec();
  }

  private findOcrFallbackServings(excludedDate?: string | null) {
    const filter: Record<string, unknown> = {
      status: { $ne: MenuServingStatus.HIDDEN },
    };
    if (excludedDate) {
      filter.date = { $ne: excludedDate };
    }

    return this.menuServingModel
      .find(filter)
      .sort({ date: -1, mealTime: 1, cafeteriaId: 1 })
      .limit(250)
      .populate({ path: "mealId", select: "name" })
      .populate({ path: "cafeteriaId", select: "name" })
      .lean()
      .exec();
  }

  private async findMatchedServings(receipt: any) {
    const matchedIds = (receipt.matchedMenuServingIds ?? []) as Types.ObjectId[];
    if (matchedIds.length === 0) {
      return [];
    }
    return this.menuServingModel
      .find({ _id: { $in: matchedIds } })
      .sort({ date: -1, mealTime: 1, cafeteriaId: 1 })
      .populate({ path: "mealId", select: "name" })
      .populate({ path: "cafeteriaId", select: "name" })
      .lean()
      .exec();
  }

  private toReceiptResponse(receipt: any, matchedServings: any[]) {
    const parsed = receipt.parsed ?? {};
    return {
      id: receipt._id.toString(),
      status: receipt.status,
      parsed: {
        purchasedAt: parsed.purchasedAt ? this.dateToIsoString(parsed.purchasedAt) : undefined,
        cafeteriaName: parsed.cafeteriaName,
        mealNames: parsed.mealNames ?? [],
        totalPrice: parsed.totalPrice,
      },
      matchedMenuServings: matchedServings.map((serving) => ({
        id: serving._id.toString(),
        mealName: this.populatedName(serving.mealId),
        cafeteriaName: this.populatedName(serving.cafeteriaId),
        date: serving.date,
        price: serving.price,
      })),
      confirmedMenuServingId: this.objectIdToString(receipt.confirmedMenuServingId),
      usedForReview: receipt.usedForReview,
      reviewId: this.objectIdToString(receipt.reviewId),
      rejectReason: receipt.rejectReason,
    };
  }

  private buildPrivateImageKey(userId: string, filename?: string) {
    const safeName = (filename ?? "receipt")
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(0, 80);
    return `private/receipts/${userId}/${Date.now()}-${safeName || "receipt"}`;
  }

  private buildFakeOcrText(matches: any[]) {
    const items = matches.map((match) => this.populatedName(match.mealId)).filter(Boolean);
    return [`FAKE_OCR_PROVIDER`, `items=${items.join(",") || "unknown"}`].join("\n");
  }

  private requiredString(value: unknown, fieldName: string) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return value.trim();
  }

  private containsObjectId(values: unknown[] | undefined, target: Types.ObjectId) {
    return (values ?? []).some((value: any) => value?.toString?.() === target.toString());
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

  private populatedName(value: any): string | undefined {
    if (!value) {
      return undefined;
    }
    if (value instanceof Types.ObjectId) {
      return value.toString();
    }
    return value.name ?? value._id?.toString?.();
  }

  private dateToIsoString(value: unknown) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "string") {
      return new Date(value).toISOString();
    }
    return undefined;
  }
}

function todayInSeoul() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
