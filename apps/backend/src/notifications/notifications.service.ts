import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Notification } from "./schemas/notification.schema";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  async findUserNotifications(userId: string, limit: number = 50) {
    const notifications = await this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    return notifications.map(this.toResponse);
  }

  async getUnreadCount(userId: string) {
    const count = await this.notificationModel
      .countDocuments({
        userId: new Types.ObjectId(userId),
        readAt: { $exists: false },
      })
      .exec();

    return { unreadCount: count };
  }

  async markAsRead(userId: string, notificationId: string) {
    const updated = await this.notificationModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(notificationId),
          userId: new Types.ObjectId(userId),
        },
        {
          $set: { readAt: new Date() },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException("Notification not found");
    }

    return this.toResponse(updated);
  }

  async markAllAsRead(userId: string) {
    const result = await this.notificationModel
      .updateMany(
        {
          userId: new Types.ObjectId(userId),
          readAt: { $exists: false },
        },
        {
          $set: { readAt: new Date() },
        },
      )
      .exec();

    return { success: true, updatedCount: result.modifiedCount };
  }

  private toResponse(notification: any) {
    return {
      id: notification._id.toString(),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      resourceType: notification.resourceType,
      resourceId: notification.resourceId?.toString(),
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}
