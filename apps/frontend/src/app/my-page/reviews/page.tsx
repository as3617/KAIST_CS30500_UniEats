import type { Metadata } from "next";
import { MyReviewsView } from "./my-reviews-view";

export const metadata: Metadata = { title: "My Reviews" };

export default function MyReviewsPage() {
  return <MyReviewsView />;
}
