import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type DiscountDocument = HydratedDocument<Discount>;

@Schema({ collection: "discounts", timestamps: true })
export class Discount {
  @Prop({ required: true, trim: true, maxlength: 100 })
  cafeteriaName: string;

  @Prop({ required: true, trim: true, maxlength: 200 })
  menuName: string;

  @Prop({ required: true, min: 0 })
  discountedPrice: number;

  @Prop({ type: String })
  menuServingId?: string;

  @Prop({ required: true, type: Date })
  validUntil: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const DiscountSchema = SchemaFactory.createForClass(Discount);

DiscountSchema.index({ isActive: 1, validUntil: 1 });
