"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, Home, LogIn, MapPinned, Search, User } from "lucide-react";

import { authStorage } from "@/lib/auth-storage";
import type { User as AuthUser } from "@/types";

const publicNavLinks = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/campus-map", icon: MapPinned, label: "Map" },
];
const managerNavLink = { href: "/manager", icon: BriefcaseBusiness, label: "Manager" };
const myPageNavLink = { href: "/my-page", icon: User, label: "My Page" };
const signInNavLink = { href: "/login", icon: LogIn, label: "Sign in" };

function canUseManager(user: Pick<AuthUser, "role"> | null) {
  return user?.role === "MANAGER" || user?.role === "ADMIN";
}

export function TopHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<Pick<AuthUser, "role"> | null>(null);

  useEffect(() => {
    const syncUser = () => setUser(authStorage.getUser());
    syncUser();
    return authStorage.subscribe(syncUser);
  }, []);

  const navLinks = [
    ...publicNavLinks,
    ...(canUseManager(user) ? [managerNavLink] : []),
    user ? myPageNavLink : signInNavLink,
  ];

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="flex items-center justify-between h-14 px-6 max-w-5xl mx-auto">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <MapPinned className="h-5 w-5 text-primary" />
          UniEats
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, icon: Icon, label }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
