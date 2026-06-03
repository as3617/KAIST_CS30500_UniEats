import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { mockCafeterias } from "@/mocks/data";
import { reviewsStore } from "@/mocks/store";
import { okJson } from "@/mocks/respond";
import type { CafeteriaRankItem } from "@/types";

const POSITIVE_RATING_THRESHOLD = 3;
const REVIEW_WEIGHT_CAP = 50;

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 10) || 10;
  const items: CafeteriaRankItem[] = mockCafeterias
    .map((cafeteria) => {
      const reviews = reviewsStore.filter(
        (review) => review.cafeteriaId === cafeteria.id && review.isVerified,
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
        cafeteriaId: cafeteria.id,
        cafeteriaName: cafeteria.name,
        averageRating: Math.round(averageRating * 10) / 10,
        verifiedReviewCount,
        positiveReviewCount,
        score:
          averageRating *
          Math.log(Math.min(positiveReviewCount, REVIEW_WEIGHT_CAP) + 1),
        rank: 0,
      };
    })
    .filter((item) => item.positiveReviewCount > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.cafeteriaId.localeCompare(b.cafeteriaId);
    })
    .slice(0, limit)
    .map((item, index) => ({
      cafeteriaId: item.cafeteriaId,
      cafeteriaName: item.cafeteriaName,
      averageRating: item.averageRating,
      verifiedReviewCount: item.verifiedReviewCount,
      positiveReviewCount: item.positiveReviewCount,
      rank: index + 1,
    }));

  return okJson(items);
}
