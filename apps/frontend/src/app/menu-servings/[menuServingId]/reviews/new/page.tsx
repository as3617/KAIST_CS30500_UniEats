import type { Metadata } from "next";
import { NewReviewView } from "./new-review-view";

export const metadata: Metadata = { title: "Write a Review" };

export default function NewReviewPage({
  params,
}: {
  params: { menuServingId: string };
}) {
  return <NewReviewView menuServingId={params.menuServingId} />;
}
