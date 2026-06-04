import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../../_utils";
import { errorJson, okJson } from "@/mocks/respond";
import { favoritesStore, mealsStore } from "@/mocks/store";
import type { FavoriteMeal, Meal } from "@/types";

function isAuthorized(request: NextRequest) {
  return (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
}

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) {
    return proxyToBackend(request);
  }

  if (!isAuthorized(request)) {
    return errorJson(401, "UNAUTHORIZED", "Missing access token");
  }

  return okJson(favoritesStore);
}

export async function POST(request: NextRequest) {
  if (!shouldUseMockApi()) {
    return proxyToBackend(request);
  }

  if (!isAuthorized(request)) {
    return errorJson(401, "UNAUTHORIZED", "Missing access token");
  }

  const body = (await request.json().catch(() => null)) as
    | { mealId?: unknown }
    | null;
  const mealId = typeof body?.mealId === "string" ? body.mealId.trim() : "";
  if (!mealId) {
    return errorJson(400, "VALIDATION_ERROR", "mealId is required");
  }

  const meal = mealsStore.find((item) => item.id === mealId);
  if (!meal) {
    return errorJson(404, "NOT_FOUND", "meal not found");
  }

  if (favoritesStore.some((favorite) => favorite.mealId === mealId)) {
    return errorJson(409, "CONFLICT", "meal already in favorites");
  }

  const favorite: FavoriteMeal = {
    id: `fav_${Date.now()}`,
    mealId,
    meal: toFavoriteMeal(meal),
    createdAt: new Date().toISOString(),
  };
  favoritesStore.unshift(favorite);

  return okJson(favorite, "Added to favorites");
}

function toFavoriteMeal(meal: Meal): FavoriteMeal["meal"] {
  return {
    id: meal.id,
    name: meal.name,
    category: meal.category,
    imageUrl: meal.imageUrl,
    dietaryLabels: [...meal.dietaryLabels],
    allergens: [...meal.allergens],
  };
}
