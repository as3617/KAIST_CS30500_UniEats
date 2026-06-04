import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { NotificationResourceType, NotificationType } from "../common/enums";
import { toObjectId } from "../common/object-id";
import { Notification } from "./schemas/notification.schema";

export interface NotificationCreateInput {
  userId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  resourceType?: NotificationResourceType;
  resourceId?: string | Types.ObjectId;
}

export type NotificationCreateManyInput = Omit<NotificationCreateInput, "userId"> & {
  userIds: Array<string | Types.ObjectId>;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  async createForUser(input: NotificationCreateInput) {
    const notification = await this.notificationModel.create({
      userId: this.normalizeObjectId(input.userId, "userId"),
      type: input.type,
      title: input.title,
      message: input.message,
      resourceType: input.resourceType,
      resourceId: input.resourceId
        ? this.normalizeObjectId(input.resourceId, "resourceId")
        : undefined,
    });

    return this.toResponse(notification.toObject());
  }

  async createForUsers(input: NotificationCreateManyInput) {
    const userIds = this.uniqueObjectIds(input.userIds, "userIds");
    if (userIds.length === 0) {
      return { createdCount: 0 };
    }

    const notifications = await this.notificationModel.insertMany(
      userIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        resourceType: input.resourceType,
        resourceId: input.resourceId
          ? this.normalizeObjectId(input.resourceId, "resourceId")
          : undefined,
      })),
      { ordered: false },
    );

    return { createdCount: notifications.length };
  }

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
        { returnDocument: "after" },
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

  private normalizeObjectId(value: string | Types.ObjectId, fieldName: string) {
    if (value instanceof Types.ObjectId) {
      return value;
    }
    return toObjectId(value, fieldName);
  }

  private uniqueObjectIds(values: Array<string | Types.ObjectId>, fieldName: string) {
    const seen = new Set<string>();
    const objectIds: Types.ObjectId[] = [];

    values.forEach((value, index) => {
      const objectId = this.normalizeObjectId(value, `${fieldName}.${index}`);
      const key = objectId.toString();
      if (!seen.has(key)) {
        seen.add(key);
        objectIds.push(objectId);
      }
    });

    return objectIds;
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
