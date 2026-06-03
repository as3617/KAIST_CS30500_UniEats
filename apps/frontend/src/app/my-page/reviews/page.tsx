import type { Metadata } from "next";
import { MyReviewsView } from "./my-reviews-view";

export const metadata: Metadata = { title: "My Reviews" };

type MyReviewsPageProps = {
  searchParams?: {
    reviewId?: string;
  };
};

export default function MyReviewsPage({ searchParams }: MyReviewsPageProps) {
  return <MyReviewsView highlightedReviewId={searchParams?.reviewId} />;
}
