import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ _id: false })
export class DetailRatings {
  @Prop({ type: Number, required: true, min: 1, max: 5 })
  taste: number;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  price: number;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  portion: number;
}

export const DetailRatingsSchema = SchemaFactory.createForClass(DetailRatings);

@Schema({ _id: false })
export class ManagerReply {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  managerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  content: string;

  @Prop({ type: Date, required: true })
  repliedAt: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const ManagerReplySchema = SchemaFactory.createForClass(ManagerReply);

@Schema({ collection: "reviews", timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Meal", required: true })
  mealId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "MenuServing", required: true })
  menuServingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Cafeteria", required: true })
  cafeteriaId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Receipt", required: true })
  receiptId: Types.ObjectId;

  @Prop({ type: Boolean, default: true })
  isVerified: boolean;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: DetailRatingsSchema, required: true })
  detailRatings: DetailRatings;

  @Prop({ trim: true })
  content?: string;

  @Prop({ type: ManagerReplySchema })
  managerReply?: ManagerReply;

  @Prop({ type: Date })
  deletedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: "User" })
  deletedBy?: Types.ObjectId;

  @Prop({ trim: true })
  deleteReason?: string;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.index({ menuServingId: 1, createdAt: -1 });
ReviewSchema.index({ mealId: 1, createdAt: -1 });
ReviewSchema.index({ cafeteriaId: 1, createdAt: -1 });
ReviewSchema.index({ userId: 1, createdAt: -1 });
ReviewSchema.index({ receiptId: 1 }, { unique: true });
ReviewSchema.index({ deletedAt: 1 });
