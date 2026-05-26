import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type FavoriteDocument = HydratedDocument<Favorite>;

@Schema({
  collection: "favorites",
  timestamps: { createdAt: true, updatedAt: false },
})
export class Favorite {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Meal", required: true })
  mealId: Types.ObjectId;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

FavoriteSchema.index({ userId: 1, mealId: 1 }, { unique: true });
