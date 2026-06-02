import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { menuServingsStore, reviewsStore } from "@/mocks/store";
import { okJson } from "@/mocks/respond";
import type { WeeklyBestItem } from "@/types";

const POSITIVE_RATING_THRESHOLD = 3;
const REVIEW_WEIGHT_CAP = 50;

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 10) || 10;
  const items: WeeklyBestItem[] = menuServingsStore
    .map((serving) => {
      const reviews = reviewsStore.filter(
        (review) => review.menuServingId === serving.id && review.isVerified,
      );
      const verifiedReviewCount = reviews.length;
      const positiveReviewCount = reviews.filter(
        (review) => review.rating >= POSITIVE_RATING_THRESHOLD,
      ).length;
      const averageRating =
        verifiedReviewCount > 0
          ? reviews.reduce((sum, review) => sum + review.rating, 0) / verifiedReviewCount
          : 0;
      return {
        menuServingId: serving.id,
        mealName: serving.meal.name,
        cafeteriaName: serving.cafeteria.name,
        averageRating: Math.round(averageRating * 10) / 10,
        verifiedReviewCount,
        positiveReviewCount,
        score:
          Math.round(
            averageRating *
              Math.log(Math.min(positiveReviewCount, REVIEW_WEIGHT_CAP) + 1) *
              100,
          ) / 100,
      };
    })
    .filter((item) => item.positiveReviewCount > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return okJson(items);
}
