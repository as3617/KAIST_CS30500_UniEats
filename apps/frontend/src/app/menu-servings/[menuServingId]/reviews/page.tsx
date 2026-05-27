import type { Metadata } from "next";
import { ReviewListView } from "./review-list-view";

export const metadata: Metadata = { title: "Reviews" };

export default function ReviewsPage({
  params,
}: {
  params: { menuServingId: string };
}) {
  return <ReviewListView menuServingId={params.menuServingId} />;
}
