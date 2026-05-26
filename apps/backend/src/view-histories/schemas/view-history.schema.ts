import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type ViewHistoryDocument = HydratedDocument<ViewHistory>;

@Schema({ collection: "view_histories" })
export class ViewHistory {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Meal", required: true })
  mealId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "MenuServing" })
  menuServingId?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  viewedAt: Date;
}

export const ViewHistorySchema = SchemaFactory.createForClass(ViewHistory);

ViewHistorySchema.index({ userId: 1, viewedAt: -1 });
