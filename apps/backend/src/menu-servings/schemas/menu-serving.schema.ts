import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import {
  MEAL_TIMES,
  MENU_SOURCES,
  MENU_SERVING_STATUSES,
  MealTime,
  MenuSource,
  MenuServingStatus,
} from "../../common/enums";

export type MenuServingDocument = HydratedDocument<MenuServing>;

@Schema({ collection: "menu_servings", timestamps: true })
export class MenuServing {
  @Prop({ type: Types.ObjectId, ref: "Meal", required: true })
  mealId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Cafeteria", required: true })
  cafeteriaId: Types.ObjectId;

  @Prop({ required: true, match: /^\d{4}-\d{2}-\d{2}$/ })
  date: string;

  @Prop({ type: String, enum: MEAL_TIMES, required: true })
  mealTime: MealTime;

  @Prop({ type: Number, required: true, min: 0 })
  price: number;

  @Prop({
    type: String,
    enum: MENU_SERVING_STATUSES,
    required: true,
    default: MenuServingStatus.AVAILABLE,
  })
  status: MenuServingStatus;

  @Prop({ type: Number, min: 0 })
  stock?: number;

  @Prop({ type: Number, default: 0, min: 0, max: 5 })
  averageRating: number;

  @Prop({ type: Number, default: 0, min: 0 })
  verifiedReviewCount: number;

  @Prop({ type: String, enum: MENU_SOURCES, default: MenuSource.FIXED_MENU })
  source: MenuSource;

  @Prop({ trim: true })
  sourceExternalKey?: string;

  @Prop({ trim: true })
  sourceUrl?: string;

  @Prop({ type: Date })
  lastSyncedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  createdBy: Types.ObjectId;
}

export const MenuServingSchema = SchemaFactory.createForClass(MenuServing);

MenuServingSchema.index(
  { date: 1, cafeteriaId: 1, mealTime: 1, mealId: 1 },
  { unique: true },
);
MenuServingSchema.index({ date: 1, status: 1 });
MenuServingSchema.index({ mealId: 1 });
MenuServingSchema.index({ averageRating: -1, verifiedReviewCount: -1 });
MenuServingSchema.index(
  { source: 1, sourceExternalKey: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceExternalKey: { $type: "string" } },
  },
);
