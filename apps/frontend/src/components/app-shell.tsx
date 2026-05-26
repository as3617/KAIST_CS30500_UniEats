"use client";

import { usePathname } from "next/navigation";
import { BottomTabBar } from "./bottom-tab-bar";
import { TopHeader } from "./top-header";

const AUTH_PATHS = ["/login", "/register"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = !AUTH_PATHS.some((p) => pathname.startsWith(p));

  return (
    <>
      {/* 데스크탑: 상단 헤더 */}
      {showNav && (
        <div className="hidden md:block">
          <TopHeader />
        </div>
      )}

      {/* 콘텐츠: 모바일은 하단 탭바 여백, 데스크탑은 여백 없음 */}
      <div className={showNav ? "pb-16 md:pb-0" : ""}>{children}</div>

      {/* 모바일: 하단 탭바 */}
      {showNav && (
        <div className="md:hidden">
          <BottomTabBar />
        </div>
      )}
    </>
  );
}
