"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, User } from "lucide-react";

const tabs = [
  { href: "/my-page/receipt", icon: Plus },
  { href: "/dashboard", icon: Home },
  { href: "/my-page", icon: User },
] as const;

function getActiveTab(pathname: string): string {
  if (pathname.startsWith("/my-page/receipt")) return "/my-page/receipt";
  if (pathname.startsWith("/my-page")) return "/my-page";
  return "/dashboard";
}

export function BottomTabBar() {
  const pathname = usePathname();
  const activeHref = getActiveTab(pathname);

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
