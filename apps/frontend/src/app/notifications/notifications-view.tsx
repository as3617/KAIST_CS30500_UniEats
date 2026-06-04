"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  MessageSquareReply,
  ReceiptText,
  UtensilsCrossed,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiClientError, api } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import {
  getNotificationHref,
  notifyNotificationsChanged,
} from "@/lib/notifications";
import type { Notification } from "@/types";

type NotificationReadAllResult = {
  updatedCount: number;
};

export function NotificationsView() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  useEffect(() => {
    const user = authStorage.getUser();
    setIsLoggedIn(Boolean(user));
    if (!user) {
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    setIsLoading(true);
    setError(null);

    api
      .get<Notification[]>("/notifications", { query: { limit: 100 } })
      .then((data) => {
        if (isCurrent) setNotifications(data);
      })
      .catch((err) => {
        if (!isCurrent) return;
        setError(err instanceof ApiClientError ? err.message : "Failed to load notifications");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  async function markAsRead(notification: Notification) {
    if (notification.readAt) {
      return notification;
    }

    const updated = await api.patch<Notification>(
      `/notifications/${notification.id}/read`,
    );
    setNotifications((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    notifyNotificationsChanged();
    return updated;
  }

  async function openNotification(notification: Notification) {
    setIsMutating(notification.id);
    setError(null);

    try {
      const updated = await markAsRead(notification);
      const href = getNotificationHref(updated);
      if (href) {
        router.push(href);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update notification");
    } finally {
      setIsMutating(null);
    }
  }

  async function markAllAsRead() {
    setIsMutating("read-all");
    setError(null);

    try {
      await api.patch<NotificationReadAllResult>("/notifications/read-all");
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? readAt,
        })),
      );
      notifyNotificationsChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update notifications");
    } finally {
      setIsMutating(null);
    }
  }

  if (!isLoggedIn) {
    return (
      <main className="container max-w-3xl space-y-6 py-8">
        <BackButton />
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Notifications are available after signing in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container max-w-3xl space-y-6 py-8">
      <BackButton />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">My Page</p>
          <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
              : "All caught up"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={markAllAsRead}
          disabled={unreadCount === 0 || isMutating === "read-all"}
        >
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </Button>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <Bell className="h-8 w-8" />
          <p className="text-sm">No notifications yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <NotificationItem
                notification={notification}
                isMutating={isMutating === notification.id}
                onOpen={() => openNotification(notification)}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function BackButton() {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/dashboard">
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>
    </Button>
  );
}

function NotificationItem({
  notification,
  isMutating,
  onOpen,
}: {
  notification: Notification;
  isMutating: boolean;
  onOpen: () => void;
}) {
  const Icon = notificationIcon(notification.type);
  const isUnread = !notification.readAt;
  const href = getNotificationHref(notification);

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={isMutating}
      className={`block w-full rounded-lg border bg-card text-left transition-colors hover:border-primary/50 hover:bg-primary/5 ${
        isUnread ? "border-primary/40" : "border-border"
      }`}
    >
      <div className="flex gap-3 p-4">
        <span
          className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isUnread ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{notification.title}</span>
            {isUnread ? <Badge>New</Badge> : null}
          </span>
          <span className="block text-sm text-muted-foreground">
            {notification.message}
          </span>
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatNotificationDate(notification.createdAt)}</span>
            {href ? <span>Open related item</span> : null}
          </span>
        </span>
      </div>
    </button>
  );
}

function notificationIcon(type: Notification["type"]) {
  switch (type) {
    case "MANAGER_REPLY":
      return MessageSquareReply;
    case "RECEIPT_STATUS_UPDATED":
    case "REVIEW_AVAILABLE":
      return ReceiptText;
    case "MENU_STATUS_UPDATED":
      return UtensilsCrossed;
    default:
      return Bell;
  }
}

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
