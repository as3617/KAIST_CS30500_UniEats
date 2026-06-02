import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import {
  OCR_PROVIDERS,
  RECEIPT_STATUSES,
  OcrProvider,
  ReceiptStatus,
} from "../../common/enums";

export type ReceiptDocument = HydratedDocument<Receipt>;

@Schema({ _id: false })
export class ParsedReceipt {
  @Prop({ type: Date })
  purchasedAt?: Date;

  @Prop({ trim: true })
  cafeteriaName?: string;

  @Prop({ type: [String], default: [] })
  mealNames?: string[];

  @Prop({ type: Number, min: 0 })
  totalPrice?: number;

  @Prop({ trim: true })
  approvalNumber?: string;
}

export const ParsedReceiptSchema = SchemaFactory.createForClass(ParsedReceipt);

@Schema({ collection: "receipts", timestamps: true })
export class Receipt {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  imageUrl: string;

  @Prop({ type: Date })
  imageDeletedAt?: Date;

  @Prop({ type: String, enum: OCR_PROVIDERS, required: true, default: OcrProvider.FAKE })
  ocrProvider: OcrProvider;

  @Prop()
  ocrRawText?: string;

  @Prop({ type: Date })
  ocrRawTextDeletedAt?: Date;

  @Prop({ type: ParsedReceiptSchema, default: () => ({}) })
  parsed: ParsedReceipt;

  @Prop({ type: [{ type: Types.ObjectId, ref: "MenuServing" }], default: [] })
  matchedMenuServingIds: Types.ObjectId[];

  @Prop({ type: String, enum: RECEIPT_STATUSES, required: true, default: ReceiptStatus.UPLOADED })
  status: ReceiptStatus;

  @Prop({ trim: true })
  rejectReason?: string;

  @Prop({ type: Types.ObjectId, ref: "MenuServing" })
  confirmedMenuServingId?: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  usedForReview: boolean;

  @Prop({ type: Types.ObjectId, ref: "Review" })
  reviewId?: Types.ObjectId;
}

export const ReceiptSchema = SchemaFactory.createForClass(Receipt);

ReceiptSchema.index({ userId: 1, createdAt: -1 });
ReceiptSchema.index({ status: 1 });
ReceiptSchema.index({ reviewId: 1 }, { unique: true, sparse: true });
ReceiptSchema.index({ confirmedMenuServingId: 1 });
