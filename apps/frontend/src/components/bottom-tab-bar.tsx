"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, LogIn, MapPinned, Search, User } from "lucide-react";

import { authStorage } from "@/lib/auth-storage";
import type { User as AuthUser } from "@/types";

const publicTabs = [
  { href: "/campus-map", icon: MapPinned },
  { href: "/dashboard", icon: Home },
  { href: "/search", icon: Search },
] as const;
const myPageTab = { href: "/my-page", icon: User } as const;
const signInTab = { href: "/login", icon: LogIn } as const;

function getActiveTab(pathname: string): string {
  if (pathname.startsWith("/campus-map")) return "/campus-map";
  if (pathname.startsWith("/search")) return "/search";
  if (pathname.startsWith("/my-page")) return "/my-page";
  if (pathname.startsWith("/login")) return "/login";
  return "/dashboard";
}

export function BottomTabBar() {
  const pathname = usePathname();
  const [user, setUser] = useState<Pick<AuthUser, "id"> | null>(null);
  const activeHref = getActiveTab(pathname);
  const tabs = [...publicTabs, user ? myPageTab : signInTab];

  useEffect(() => {
    const syncUser = () => setUser(authStorage.getUser());
    syncUser();
    return authStorage.subscribe(syncUser);
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-8">
        {tabs.map(({ href, icon: Icon }) => {
          const isActive = activeHref === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center justify-center w-12 h-12 rounded-xl transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 1.8} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
