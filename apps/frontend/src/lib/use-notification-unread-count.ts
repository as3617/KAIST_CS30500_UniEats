"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiClientError, api } from "@/lib/api";
import { subscribeNotificationsChanged } from "@/lib/notifications";
import type { NotificationUnreadCount, User } from "@/types";

const UNREAD_COUNT_REFRESH_MS = 30_000;

export function useNotificationUnreadCount(
  user: Pick<User, "id"> | null,
) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      const data = await api.get<NotificationUnreadCount>(
        "/notifications/unread-count",
      );
      setUnreadCount(data.unreadCount);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        setUnreadCount(0);
      }
    }
  }, [user]);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!user) return;

    const interval = window.setInterval(
      refreshUnreadCount,
      UNREAD_COUNT_REFRESH_MS,
    );
    const unsubscribe = subscribeNotificationsChanged(refreshUnreadCount);
    window.addEventListener("focus", refreshUnreadCount);

    return () => {
      window.clearInterval(interval);
      unsubscribe();
      window.removeEventListener("focus", refreshUnreadCount);
    };
  }, [refreshUnreadCount, user]);

  return unreadCount;
}
