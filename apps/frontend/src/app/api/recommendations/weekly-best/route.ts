import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { menuServingsStore } from "@/mocks/store";
import { okJson } from "@/mocks/respond";
import type { WeeklyBestItem } from "@/types";

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 10) || 10;
  const items: WeeklyBestItem[] = menuServingsStore
    .filter((serving) => serving.verifiedReviewCount > 0)
    .map((serving) => ({
      menuServingId: serving.id,
      mealName: serving.meal.name,
      cafeteriaName: serving.cafeteria.name,
      averageRating: serving.averageRating,
      verifiedReviewCount: serving.verifiedReviewCount,
      score: serving.averageRating * Math.log(serving.verifiedReviewCount + 1),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return okJson(items);
}
