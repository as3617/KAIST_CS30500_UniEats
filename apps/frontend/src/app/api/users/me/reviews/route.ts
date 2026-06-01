import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../../_utils";
import { mockUser } from "@/mocks/data";
import { menuServingsStore, reviewsStore } from "@/mocks/store";
import { errorJson, okJson } from "@/mocks/respond";
import type { PaginatedData, Review } from "@/types";

export type UserReview = Review & {
  mealName: string;
  cafeteriaName: string;
};

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const isAuthenticated = (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
  if (!isAuthenticated) return errorJson(401, "UNAUTHORIZED", "sign in required");

  const myReviews = reviewsStore
    .filter((r) => r.userId === mockUser.id)
    .map((r): UserReview => {
      const serving = menuServingsStore.find((s) => s.id === r.menuServingId);
      return {
        ...r,
        mealName: serving?.meal.name ?? r.mealId,
        cafeteriaName: serving?.cafeteria.name ?? r.cafeteriaId,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const result: PaginatedData<UserReview> = {
    items: myReviews,
    page: 1,
    limit: 20,
    total: myReviews.length,
  };
  return okJson(result);
}
