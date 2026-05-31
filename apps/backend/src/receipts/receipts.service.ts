/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AuthService } from "../auth/auth.service";
import { OcrProvider, ReceiptStatus } from "../common/enums";
import { toObjectId } from "../common/object-id";
import { MenuServing } from "../menu-servings/schemas/menu-serving.schema";
import { Receipt } from "./schemas/receipt.schema";

export interface ConfirmReceiptBody {
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
  ) {}

  async upload(authorization: string | undefined, file?: any) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });

    const today = new Date().toISOString().split("T")[0];
    const todayServings: any[] = await this.menuServingModel
      .find({ date: today })
      .populate({ path: "mealId", select: "name" })
      .populate({ path: "cafeteriaId", select: "name" })
      .lean()
      .exec();

    const imageUrl = file
      ? `https://storage.fake/receipts/${currentUser.id}/${Date.now()}.jpg`
      : "https://storage.fake/receipts/placeholder.jpg";

    const receipt = await this.receiptModel.create({
      userId: new Types.ObjectId(currentUser.id),
      imageUrl,
      ocrProvider: OcrProvider.FAKE,
      ocrRawText: "FAKE OCR",
      parsed: {
        purchasedAt: new Date(),
        cafeteriaName: todayServings[0]?.cafeteriaId?.name,
        mealNames: todayServings.slice(0, 2).map((s: any) => s.mealId?.name),
        totalPrice: todayServings[0]?.price,
      },
      matchedMenuServingIds: todayServings.map((s: any) => s._id),
      status: ReceiptStatus.NEED_CONFIRMATION,
    });

    return this.toResponse(receipt.toObject(), todayServings);
  }

  async findById(receiptId: string, authorization: string | undefined) {
    const currentUser = await this.authService.requireUser(authorization);
    const _id = toObjectId(receiptId, "receiptId");

    const receipt: any = await this.receiptModel.findById(_id).lean().exec();
    if (!receipt) throw new NotFoundException("receipt not found");
    if (!receipt.userId.equals(new Types.ObjectId(currentUser.id))) {
      throw new ForbiddenException("access denied");
    }

    const servings: any[] = await this.menuServingModel
      .find({ _id: { $in: receipt.matchedMenuServingIds } })
      .populate({ path: "mealId", select: "name" })
      .populate({ path: "cafeteriaId", select: "name" })
      .lean()
      .exec();

    return this.toResponse(receipt, servings);
  }

  async confirm(
    receiptId: string,
    authorization: string | undefined,
    body: ConfirmReceiptBody,
  ) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });

    const _id = toObjectId(receiptId, "receiptId");
    const receipt: any = await this.receiptModel.findById(_id).lean().exec();
    if (!receipt) throw new NotFoundException("receipt not found");
    if (!receipt.userId.equals(new Types.ObjectId(currentUser.id))) {
      throw new ForbiddenException("access denied");
    }
    if (receipt.status !== ReceiptStatus.NEED_CONFIRMATION) {
      throw new BadRequestException("receipt is not pending confirmation");
    }

    const menuServingId =
      typeof body.menuServingId === "string" ? body.menuServingId.trim() : null;
    if (!menuServingId) throw new BadRequestException("menuServingId is required");

    const servingId = toObjectId(menuServingId, "menuServingId");
    const serving: any = await this.menuServingModel.findById(servingId).lean().exec();
    if (!serving) throw new NotFoundException("menu serving not found");

    const updated: any = await this.receiptModel
      .findByIdAndUpdate(
        _id,
        { status: ReceiptStatus.VERIFIED, confirmedMenuServingId: servingId },
        { returnDocument: "after" },
      )
      .lean()
      .exec();

    return this.toResponse(updated, [serving]);
  }

  private toResponse(receipt: any, servings: any[]) {
    return {
      id: String(receipt._id),
      status: receipt.status,
      parsed: {
        purchasedAt: receipt.parsed?.purchasedAt
          ? new Date(receipt.parsed.purchasedAt).toISOString()
          : undefined,
        cafeteriaName: receipt.parsed?.cafeteriaName,
        mealNames: receipt.parsed?.mealNames,
        totalPrice: receipt.parsed?.totalPrice,
      },
      matchedMenuServings: servings.map((s) => ({
        id: String(s._id),
        mealName: typeof s.mealId === "object" ? s.mealId?.name : String(s.mealId),
        cafeteriaName: typeof s.cafeteriaId === "object" ? s.cafeteriaId?.name : String(s.cafeteriaId),
        date: s.date,
        price: s.price,
      })),
      confirmedMenuServingId: receipt.confirmedMenuServingId
        ? String(receipt.confirmedMenuServingId)
        : undefined,
      usedForReview: receipt.usedForReview,
      reviewId: receipt.reviewId ? String(receipt.reviewId) : undefined,
    };
  }
}
