"use client";

import type { Notification } from "@/types";

export const NOTIFICATIONS_CHANGED_EVENT = "unieats.notifications-change";

export function getNotificationHref(notification: Notification) {
  if (!notification.resourceType || !notification.resourceId) {
    return undefined;
  }

  switch (notification.resourceType) {
    case "MENU_SERVING":
      return `/menu-servings/${notification.resourceId}`;
    case "REVIEW":
      return `/my-page/reviews?reviewId=${notification.resourceId}`;
    case "RECEIPT":
      return `/receipts/${notification.resourceId}`;
    case "CAFETERIA":
      return `/campus-map?cafeteriaId=${notification.resourceId}`;
    case "MEAL":
      return `/dashboard`;
    default:
      return undefined;
  }
}

export function notifyNotificationsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export function subscribeNotificationsChanged(listener: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
}
