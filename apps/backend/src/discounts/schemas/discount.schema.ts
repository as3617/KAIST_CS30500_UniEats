import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type DiscountDocument = HydratedDocument<Discount>;

@Schema({ collection: "discounts", timestamps: true })
export class Discount {
  @Prop({ type: Types.ObjectId, ref: "Cafeteria" })
  cafeteriaId?: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100 })
  cafeteriaName: string;

  @Prop({ required: true, trim: true, maxlength: 200 })
  menuName: string;

  @Prop({ required: true, min: 0 })
  discountedPrice: number;

  @Prop({ type: Types.ObjectId, ref: "MenuServing" })
  menuServingId?: Types.ObjectId;

  @Prop({ required: true, type: Date })
  validUntil: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const DiscountSchema = SchemaFactory.createForClass(Discount);

DiscountSchema.index({ isActive: 1, validUntil: 1 });
DiscountSchema.index({ cafeteriaId: 1, isActive: 1, validUntil: 1 });
DiscountSchema.index({ menuServingId: 1 });
