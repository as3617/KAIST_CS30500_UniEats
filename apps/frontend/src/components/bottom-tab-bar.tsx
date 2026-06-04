"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, CircleHelp, Home, LogIn, MapPinned, Search, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { authStorage } from "@/lib/auth-storage";
import { useNotificationUnreadCount } from "@/lib/use-notification-unread-count";
import type { User as AuthUser } from "@/types";

type Tab = {
  href: string;
  icon: LucideIcon;
  badge?: number;
};

const publicTabs: Tab[] = [
  { href: "/campus-map", icon: MapPinned },
  { href: "/dashboard", icon: Home },
  { href: "/search", icon: Search },
  { href: "/help", icon: CircleHelp },
];
const notificationsTab: Tab = { href: "/notifications", icon: Bell };
const myPageTab: Tab = { href: "/my-page", icon: User };
const signInTab: Tab = { href: "/login", icon: LogIn };

function getActiveTab(pathname: string): string {
  if (pathname.startsWith("/campus-map")) return "/campus-map";
  if (pathname.startsWith("/search")) return "/search";
  if (pathname.startsWith("/help")) return "/help";
  if (pathname.startsWith("/notifications")) return "/notifications";
  if (pathname.startsWith("/my-page")) return "/my-page";
  if (pathname.startsWith("/login")) return "/login";
  return "/dashboard";
}

export function BottomTabBar() {
  const pathname = usePathname();
  const [user, setUser] = useState<Pick<AuthUser, "id"> | null>(null);
  const unreadCount = useNotificationUnreadCount(user);
  const activeHref = getActiveTab(pathname);
  const tabs: Tab[] = [
    ...publicTabs,
    ...(user ? [{ ...notificationsTab, badge: unreadCount }, myPageTab] : [signInTab]),
  ];

  useEffect(() => {
    const syncUser = () => setUser(authStorage.getUser());
    syncUser();
    return authStorage.subscribe(syncUser);
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="flex h-16 max-w-lg items-center justify-around px-3 mx-auto">
        {tabs.map(({ href, icon: Icon, badge = 0 }) => {
          const isActive = activeHref === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 1.8} />
              {badge > 0 ? (
                <span className="absolute right-1.5 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
                  {badge > 99 ? "99+" : badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
