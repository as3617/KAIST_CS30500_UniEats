import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { toObjectId } from "../common/object-id";
import { Notification } from "./schemas/notification.schema";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  async findUserNotifications(userId: string, limit: number = 50) {
    const userObjectId = toObjectId(userId, "userId");
    const notifications = await this.notificationModel
      .find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    return notifications.map(this.toResponse);
  }

  async getUnreadCount(userId: string) {
    const userObjectId = toObjectId(userId, "userId");
    const count = await this.notificationModel
      .countDocuments({
        userId: userObjectId,
        readAt: { $exists: false },
      })
      .exec();

    return { unreadCount: count };
  }

  async markAsRead(userId: string, notificationId: string) {
    const userObjectId = toObjectId(userId, "userId");
    const notificationObjectId = toObjectId(notificationId, "notificationId");
    const updated = await this.notificationModel
      .findOneAndUpdate(
        {
          _id: notificationObjectId,
          userId: userObjectId,
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
    const userObjectId = toObjectId(userId, "userId");
    const result = await this.notificationModel
      .updateMany(
        {
          userId: userObjectId,
          readAt: { $exists: false },
        },
        {
          $set: { readAt: new Date() },
        },
      )
      .exec();

    return { updatedCount: result.modifiedCount };
  }

  private toResponse(notification: any) {
    return {
      id: notification._id.toString(),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      resourceType: notification.resourceType,
      resourceId: notification.resourceId?.toString(),
      readAt: notification.readAt ?? null,
      createdAt: notification.createdAt,
    };
  }
}
