import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import {
  ALLERGY_CODES,
  CATEGORY_CODES,
  DIETARY_LABEL_CODES,
  AllergyCode,
  CategoryCode,
  DietaryLabelCode,
} from "../../common/enums";

export type MealDocument = HydratedDocument<Meal>;

@Schema({ _id: false })
export class Nutrition {
  @Prop({ type: Number, min: 0 })
  calories?: number;

  @Prop({ type: Number, min: 0 })
  carbohydrate?: number;

  @Prop({ type: Number, min: 0 })
  protein?: number;

  @Prop({ type: Number, min: 0 })
  fat?: number;

  @Prop({ type: Number, min: 0 })
  sodium?: number;
}

export const NutritionSchema = SchemaFactory.createForClass(Nutrition);

@Schema({ collection: "meals", timestamps: true })
export class Meal {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: String, enum: CATEGORY_CODES, required: true })
  category: CategoryCode;

  @Prop({ trim: true })
  imageUrl?: string;

  @Prop({ type: [String], default: [] })
  ingredients: string[];

  @Prop({ type: [String], enum: ALLERGY_CODES, default: [] })
  allergens: AllergyCode[];

  @Prop({ type: [String], enum: DIETARY_LABEL_CODES, default: [] })
  dietaryLabels: DietaryLabelCode[];

  @Prop({ type: NutritionSchema, default: () => ({}) })
  nutrition: Nutrition;

  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  createdBy: Types.ObjectId;
}

export const MealSchema = SchemaFactory.createForClass(Meal);

MealSchema.index({ name: "text", ingredients: "text" });
MealSchema.index({ category: 1 });
MealSchema.index({ allergens: 1 });
MealSchema.index({ dietaryLabels: 1 });
