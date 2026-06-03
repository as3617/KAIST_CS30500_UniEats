import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import {
  NOTIFICATION_RESOURCE_TYPES,
  NOTIFICATION_TYPES,
  NotificationResourceType,
  NotificationType,
} from "../../common/enums";

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ collection: "notifications", timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: NOTIFICATION_TYPES, required: true })
  type: NotificationType;

  @Prop({ required: true, trim: true, maxlength: 120 })
  title: string;

  @Prop({ required: true, trim: true, maxlength: 1000 })
  message: string;

  @Prop({ type: String, enum: NOTIFICATION_RESOURCE_TYPES })
  resourceType?: NotificationResourceType;

  @Prop({ type: Types.ObjectId })
  resourceId?: Types.ObjectId;

  @Prop({ type: Date })
  readAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
NotificationSchema.index({ resourceType: 1, resourceId: 1 });
