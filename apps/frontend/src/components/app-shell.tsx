"use client";

import { usePathname } from "next/navigation";
import { BottomTabBar } from "./bottom-tab-bar";
import { TopHeader } from "./top-header";

const AUTH_PATHS = ["/login", "/register", "/verify-email", "/forgot-password", "/reset-password"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = !AUTH_PATHS.some((p) => pathname.startsWith(p));

  return (
    <>
      {showNav && (
        <div className="hidden md:block">
          <TopHeader />
        </div>
      )}

      <div className={showNav ? "pb-16 md:pb-0" : ""}>{children}</div>

      {showNav && (
        <div className="md:hidden">
          <BottomTabBar />
        </div>
      )}
    </>
  );
}
