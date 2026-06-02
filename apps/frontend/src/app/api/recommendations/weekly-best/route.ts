import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { mockUser } from "@/mocks/data";
import { menuServingsStore, reviewsStore } from "@/mocks/store";
import { okJson } from "@/mocks/respond";
import type { WeeklyBestItem } from "@/types";

const POSITIVE_RATING_THRESHOLD = 3;
const REVIEW_WEIGHT_CAP = 50;
const PREFERRED_INGREDIENT_MATCH_CAP = 3;
const DISLIKED_INGREDIENT_MATCH_CAP = 3;
const PREFERRED_INGREDIENT_SCORE_BOOST = 0.15;
const DISLIKED_INGREDIENT_SCORE_PENALTY = 0.25;
const MIN_PERSONALIZED_SCORE_MULTIPLIER = 0.1;

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 10) || 10;
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const isAuthenticated = (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
  const personalizationProfile = isAuthenticated
    ? {
        preferredIngredients: normalizeIngredientList(
          mockUser.dietaryProfile.preferredIngredients,
        ),
        dislikedIngredients: normalizeIngredientList(
          mockUser.dietaryProfile.dislikedIngredients,
        ),
      }
    : null;

  const items: WeeklyBestItem[] = menuServingsStore
    .filter((serving) => serving.status !== "HIDDEN")
    .map((serving) => {
      const reviews = reviewsStore.filter(
        (review) =>
          review.menuServingId === serving.id &&
          review.isVerified &&
          isReviewInRange(review.createdAt, from, to),
      );
      const verifiedReviewCount = reviews.length;
      const positiveReviewCount = reviews.filter(
        (review) => review.rating >= POSITIVE_RATING_THRESHOLD,
      ).length;
      const averageRating =
        verifiedReviewCount > 0
          ? reviews.reduce((sum, review) => sum + review.rating, 0) / verifiedReviewCount
          : 0;
      const cappedPositiveReviewCount = Math.min(positiveReviewCount, REVIEW_WEIGHT_CAP);
      const baseScore = averageRating * Math.log(cappedPositiveReviewCount + 1);
      const sortScore = personalizationProfile
        ? applyPersonalizationScore(
            baseScore,
            serving.meal.ingredients,
            personalizationProfile,
          )
        : baseScore;

      return {
        menuServingId: serving.id,
        mealName: serving.meal.name,
        cafeteriaName: serving.cafeteria.name,
        averageRating: Math.round(averageRating * 10) / 10,
        verifiedReviewCount,
        positiveReviewCount,
        score: Math.round(sortScore * 100) / 100,
        sortScore,
        cappedPositiveReviewCount,
      };
    })
    .filter((item) => item.positiveReviewCount > 0)
    .sort((a, b) => {
      if (b.sortScore !== a.sortScore) return b.sortScore - a.sortScore;
      if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
      if (b.cappedPositiveReviewCount !== a.cappedPositiveReviewCount) {
        return b.cappedPositiveReviewCount - a.cappedPositiveReviewCount;
      }
      return a.menuServingId.localeCompare(b.menuServingId);
    })
    .slice(0, limit)
    .map(({ sortScore, cappedPositiveReviewCount, ...item }) => item);

  return okJson(items);
}

function applyPersonalizationScore(
  baseScore: number,
  ingredients: string[],
  profile: { preferredIngredients: string[]; dislikedIngredients: string[] },
) {
  const normalizedIngredients = normalizeIngredientList(ingredients);
  const preferredMatches = countPreferenceMatches(
    normalizedIngredients,
    profile.preferredIngredients,
  );
  const dislikedMatches = countPreferenceMatches(
    normalizedIngredients,
    profile.dislikedIngredients,
  );
  const multiplier = Math.max(
    MIN_PERSONALIZED_SCORE_MULTIPLIER,
    1 +
      Math.min(preferredMatches, PREFERRED_INGREDIENT_MATCH_CAP) *
        PREFERRED_INGREDIENT_SCORE_BOOST -
      Math.min(dislikedMatches, DISLIKED_INGREDIENT_MATCH_CAP) *
        DISLIKED_INGREDIENT_SCORE_PENALTY,
  );

  return baseScore * multiplier;
}

function countPreferenceMatches(ingredients: string[], preferences: string[]) {
  return preferences.filter((preference) =>
    ingredients.some((ingredient) => ingredientsMatchPreference(ingredient, preference)),
  ).length;
}

function ingredientsMatchPreference(ingredient: string, preference: string) {
  if (ingredient === preference) return true;
  return new RegExp(`(^|\\s)${escapeRegExp(preference)}(\\s|$)`).test(ingredient);
}

function normalizeIngredientList(value: string[]) {
  return [...new Set(value.map(normalizeIngredientText).filter(Boolean))];
}

function normalizeIngredientText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isReviewInRange(createdAt: string, from: string | null, to: string | null) {
  const date = createdAt.slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
