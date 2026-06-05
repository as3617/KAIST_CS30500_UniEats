"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Home,
  LogIn,
  MapPinned,
  Search,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { authStorage } from "@/lib/auth-storage";
import { useNotificationUnreadCount } from "@/lib/use-notification-unread-count";
import type { User as AuthUser } from "@/types";

type NavLink = {
  href: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
};

const publicNavLinks: NavLink[] = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/campus-map", icon: MapPinned, label: "Map" },
];
const notificationsNavLink: NavLink = { href: "/notifications", icon: Bell, label: "Notifications" };
const myPageNavLink: NavLink = { href: "/my-page", icon: User, label: "My Page" };
const signInNavLink: NavLink = { href: "/login", icon: LogIn, label: "Sign in" };

export function TopHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<Pick<AuthUser, "id" | "role"> | null>(null);
  const unreadCount = useNotificationUnreadCount(user);

  useEffect(() => {
    const syncUser = () => setUser(authStorage.getUser());
    syncUser();
    return authStorage.subscribe(syncUser);
  }, []);

  const navLinks: NavLink[] = [
    ...publicNavLinks,
    ...(user ? [{ ...notificationsNavLink, badge: unreadCount }] : []),
    user ? myPageNavLink : signInNavLink,
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
      <div className="flex items-center justify-between h-14 px-6 max-w-5xl mx-auto">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <MapPinned className="h-5 w-5 text-primary" />
          UniEats
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, icon: Icon, label, badge = 0 }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon size={16} />
                {label}
                {badge > 0 ? (
                  <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
