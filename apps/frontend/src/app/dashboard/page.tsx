import type { Metadata } from "next";

import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
};

type DashboardPageProps = {
  searchParams?: {
    cafeteriaId?: string;
  };
};

export default function DashboardPage({ searchParams }: DashboardPageProps) {
  return <DashboardView initialCafeteriaId={normalizeCafeteriaId(searchParams?.cafeteriaId)} />;
}

function normalizeCafeteriaId(value?: string) {
  if (!value || value.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(value)) {
    return "";
  }

  return value;
}
