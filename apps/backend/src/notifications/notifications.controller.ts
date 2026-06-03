import { Controller, Get, Param, Patch, Query, Headers } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { AuthService } from "../auth/auth.service";

@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async getNotifications(
    @Headers("authorization") authorization: string,
    @Query("limit") limitStr?: string,
  ) {
    const user = await this.authService.requireUser(authorization);
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    return this.notificationsService.findUserNotifications(user.id, limit);
  }

  @Get("unread-count")
  async getUnreadCount(@Headers("authorization") authorization: string) {
    const user = await this.authService.requireUser(authorization);
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch("read-all")
  async markAllAsRead(@Headers("authorization") authorization: string) {
    const user = await this.authService.requireUser(authorization);
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Patch(":notificationId/read")
  async markAsRead(
    @Param("notificationId") notificationId: string,
    @Headers("authorization") authorization: string,
  ) {
    const user = await this.authService.requireUser(authorization);
    return this.notificationsService.markAsRead(user.id, notificationId);
  }
}
