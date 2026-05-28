import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { mockCafeterias } from "@/mocks/data";
import { menuServingsStore } from "@/mocks/store";
import { okJson } from "@/mocks/respond";
import type { CafeteriaRankItem } from "@/types";

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 10) || 10;
  const items: CafeteriaRankItem[] = mockCafeterias
    .map((cafeteria) => {
      const servings = menuServingsStore.filter(
        (serving) => serving.cafeteria.id === cafeteria.id,
      );
      const verifiedReviewCount = servings.reduce(
        (sum, serving) => sum + serving.verifiedReviewCount,
        0,
      );
      const weightedTotal = servings.reduce(
        (sum, serving) => sum + serving.averageRating * serving.verifiedReviewCount,
        0,
      );
      return {
        cafeteriaId: cafeteria.id,
        cafeteriaName: cafeteria.name,
        averageRating:
          verifiedReviewCount > 0 ? weightedTotal / verifiedReviewCount : 0,
        verifiedReviewCount,
        rank: 0,
      };
    })
    .filter((item) => item.verifiedReviewCount > 0)
    .sort((a, b) => {
      if (b.averageRating !== a.averageRating) {
        return b.averageRating - a.averageRating;
      }
      return b.verifiedReviewCount - a.verifiedReviewCount;
    })
    .slice(0, limit)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  return okJson(items);
}
