import type { Metadata } from "next";

import { MenuServingDetailView } from "./menu-serving-detail-view";

export const metadata: Metadata = {
  title: "Meal details",
};

type MenuServingDetailPageProps = {
  params: {
    menuServingId: string;
  };
};

export default function MenuServingDetailPage({
  params,
}: MenuServingDetailPageProps) {
  return <MenuServingDetailView menuServingId={params.menuServingId} />;
}
