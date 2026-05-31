import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AuthService } from "../auth/auth.service";
import { Cafeteria } from "../cafeterias/schemas/cafeteria.schema";
import { MenuServingStatus, OcrProvider, ReceiptStatus } from "../common/enums";
import { toObjectId } from "../common/object-id";
import { Meal } from "../meals/schemas/meal.schema";
import { MenuServing } from "../menu-servings/schemas/menu-serving.schema";
import { Receipt } from "./schemas/receipt.schema";

const MAX_FAKE_OCR_MATCHES = 8;

export type ReceiptUploadFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
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
    @InjectModel(Meal.name)
    private readonly mealModel: Model<Meal>,
    @InjectModel(Cafeteria.name)
    private readonly cafeteriaModel: Model<Cafeteria>,
    private readonly authService: AuthService,
  ) {}

  async upload(authorization: string | undefined, file?: ReceiptUploadFile) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    this.validateUploadFile(file);

    const matches = await this.findFakeOcrMatches();
    if (matches.length === 0) {
      throw new BadRequestException("no menu serving candidates found for fake OCR");
    }
    const firstMatch = matches[0];
    const mealNames = matches
      .map((match) => this.populatedName(match.mealId))
      .filter((name): name is string => Boolean(name));
    const receipt = await this.receiptModel.create({
      userId: new Types.ObjectId(currentUser.id),
      imageUrl: this.buildPrivateImageKey(currentUser.id, file?.originalname),
      ocrProvider: OcrProvider.FAKE,
      ocrRawText: this.buildFakeOcrText(matches),
      parsed: {
        purchasedAt: new Date(),
        cafeteriaName: firstMatch ? this.populatedName(firstMatch.cafeteriaId) : undefined,
        mealNames,
        totalPrice: firstMatch?.price,
      },
      matchedMenuServingIds: matches.map((match) => match._id as Types.ObjectId),
      status: ReceiptStatus.NEED_CONFIRMATION,
      usedForReview: false,
    } as any);

    return this.toReceiptResponse((receipt as any).toObject(), matches);
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

  private async findFakeOcrMatches() {
    const today = todayInSeoul();
    let matches = await this.findServingsByDate(today);
    if (matches.length === 0) {
      matches = await this.findRecentServings();
    }
    return matches;
  }

  private findServingsByDate(date: string) {
    return this.menuServingModel
      .find({ date, status: { $ne: MenuServingStatus.HIDDEN } })
      .sort({ mealTime: 1, cafeteriaId: 1 })
      .limit(MAX_FAKE_OCR_MATCHES)
      .populate({ path: "mealId", select: "name" })
      .populate({ path: "cafeteriaId", select: "name" })
      .lean()
      .exec();
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
