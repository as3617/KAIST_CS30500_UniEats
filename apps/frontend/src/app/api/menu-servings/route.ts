import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../_utils";
import { mockCafeterias, mockUser } from "@/mocks/data";
import { discountsStore, mealsStore, menuServingsStore } from "@/mocks/store";
import { createdJson, errorJson, okJson } from "@/mocks/respond";
import {
  MEAL_TIMES,
  MENU_SERVING_STATUSES,
} from "@/types";
import type {
  AllergyCode,
  DietaryLabelCode,
  MealTime,
  MenuServing,
  MenuServingStatus,
} from "@/types";

type Query = {
  date?: string | null;
  cafeteriaId?: string | null;
  category?: string | null;
  dietaryLabel?: string | null;
  mealTime?: string | null;
  q?: string | null;
  hideAllergyConflicts?: string | null;
  page?: string | null;
  limit?: string | null;
};

const PREFERRED_INGREDIENT_MATCH_CAP = 3;
const DISLIKED_INGREDIENT_MATCH_CAP = 3;
const PREFERRED_INGREDIENT_SORT_BOOST = 0.15;
const DISLIKED_INGREDIENT_SORT_PENALTY = 0.25;

type PersonalizationProfile = {
  preferredIngredients: string[];
  dislikedIngredients: string[];
};

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) {
    return proxyToBackend(request);
  }

  const sp = request.nextUrl.searchParams;
  const query: Query = {
    date: sp.get("date"),
    cafeteriaId: sp.get("cafeteriaId"),
    category: sp.get("category"),
    dietaryLabel: sp.get("dietaryLabel"),
    mealTime: sp.get("mealTime"),
    q: sp.get("q")?.toLowerCase() ?? null,
    hideAllergyConflicts: sp.get("hideAllergyConflicts"),
    page: sp.get("page"),
    limit: sp.get("limit"),
  };

  const page = Number(query.page ?? 1) || 1;
  const limit = Number(query.limit ?? 20) || 20;
  const offset = (page - 1) * limit;

  const isAuthenticated = (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
  const userAllergies: AllergyCode[] = isAuthenticated
    ? mockUser.dietaryProfile.allergies
    : [];
  const personalizationProfile: PersonalizationProfile | null = isAuthenticated
    ? {
        preferredIngredients: normalizeIngredientList(
          mockUser.dietaryProfile.preferredIngredients,
        ),
        dislikedIngredients: normalizeIngredientList(
          mockUser.dietaryProfile.dislikedIngredients,
        ),
      }
    : null;

  let filtered = menuServingsStore.slice();

  if (query.date) {
    filtered = filtered.filter((m) => m.date === query.date);
  }
  if (query.cafeteriaId) {
    filtered = filtered.filter((m) => m.cafeteria.id === query.cafeteriaId);
  }
  if (query.category) {
    filtered = filtered.filter((m) => m.meal.category === query.category);
  }
  if (query.dietaryLabel) {
    filtered = filtered.filter((m) =>
      m.meal.dietaryLabels.includes(query.dietaryLabel as DietaryLabelCode),
    );
  }
  if (query.mealTime) {
    filtered = filtered.filter((m) => m.mealTime === query.mealTime);
  }
  if (query.q) {
    const q = query.q;
    filtered = filtered.filter((m) => {
      const searchable = [
        m.meal.name,
        m.cafeteria.name,
        ...m.meal.ingredients,
      ].join(" ");
      return searchable.toLowerCase().includes(q);
    });
  }

  const decorated: MenuServing[] = filtered.map((serving) => {
    const matchedAllergens = serving.meal.allergens.filter((a) =>
      userAllergies.includes(a),
    );
    return {
      ...serving,
      activeDiscount: findActiveDiscountForServing(serving),
      allergyWarning: isAuthenticated
        ? {
            hasConflict: matchedAllergens.length > 0,
            matchedAllergens,
          }
        : undefined,
    };
  });

  const items =
    query.hideAllergyConflicts === "true"
      ? decorated.filter((m) => !m.allergyWarning?.hasConflict)
      : decorated;
  const rankedItems = hasIngredientPreferences(personalizationProfile)
    ? sortByIngredientPreferences(items, personalizationProfile)
    : items;

  const paged = rankedItems.slice(offset, offset + limit);

  return okJson({
    items: paged,
    page,
    limit,
    total: items.length,
  });
}

function findActiveDiscountForServing(serving: MenuServing) {
  const now = new Date().toISOString();
  const discount = discountsStore
    .filter(
      (item) =>
        item.isActive &&
        item.menuServingId === serving.id &&
        item.validUntil >= now,
    )
    .sort((a, b) => {
      if (a.discountedPrice !== b.discountedPrice) {
        return a.discountedPrice - b.discountedPrice;
      }
      return a.validUntil.localeCompare(b.validUntil);
    })[0];

  return discount
    ? {
        id: discount.id,
        discountedPrice: discount.discountedPrice,
        validUntil: discount.validUntil,
      }
    : undefined;
}

export async function POST(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const isAuthenticated = (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
  if (!isAuthenticated) return errorJson(401, "UNAUTHORIZED", "sign in required");

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return errorJson(400, "VALIDATION_ERROR", "request body is required");
  }

  const meal = mealsStore.find((item) => item.id === body.mealId);
  if (!meal) return errorJson(404, "NOT_FOUND", "meal not found");

  const cafeteria = mockCafeterias.find((item) => item.id === body.cafeteriaId);
  if (!cafeteria) return errorJson(404, "NOT_FOUND", "cafeteria not found");

  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return errorJson(400, "VALIDATION_ERROR", "date must use YYYY-MM-DD format");
  }

  const mealTime = body.mealTime;
  if (typeof mealTime !== "string" || !MEAL_TIMES.includes(mealTime as MealTime)) {
    return errorJson(400, "VALIDATION_ERROR", "valid mealTime is required");
  }

  const price = body.price;
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    return errorJson(400, "VALIDATION_ERROR", "price must be a non-negative number");
  }

  const status = body.status ?? "AVAILABLE";
  if (
    typeof status !== "string" ||
    !MENU_SERVING_STATUSES.includes(status as MenuServingStatus)
  ) {
    return errorJson(400, "VALIDATION_ERROR", "valid status is required");
  }

  const stock = body.stock;
  if (
    stock !== undefined &&
    (typeof stock !== "number" || !Number.isInteger(stock) || stock < 0)
  ) {
    return errorJson(400, "VALIDATION_ERROR", "stock must be a non-negative integer");
  }

  const duplicate = menuServingsStore.find(
    (serving) =>
      serving.meal.id === meal.id &&
      serving.cafeteria.id === cafeteria.id &&
      serving.date === date &&
      serving.mealTime === mealTime,
  );
  if (duplicate) {
    return errorJson(409, "CONFLICT", "menu serving already exists");
  }

  const serving: MenuServing = {
    id: `ms_custom_${Date.now()}`,
    date,
    mealTime: mealTime as MealTime,
    price,
    status: status as MenuServingStatus,
    stock: typeof stock === "number" ? stock : undefined,
    averageRating: 0,
    verifiedReviewCount: 0,
    cafeteria: { id: cafeteria.id, name: cafeteria.name },
    meal: {
      id: meal.id,
      name: meal.name,
      category: meal.category,
      imageUrl: meal.imageUrl,
      ingredients: [...meal.ingredients],
      allergens: [...meal.allergens],
      dietaryLabels: [...meal.dietaryLabels],
    },
  };

  menuServingsStore.push(serving);
  return createdJson(serving, "Menu serving created");
}

function hasIngredientPreferences(
  profile: PersonalizationProfile | null,
): profile is PersonalizationProfile {
  return Boolean(
    profile &&
      (profile.preferredIngredients.length > 0 || profile.dislikedIngredients.length > 0),
  );
}

function sortByIngredientPreferences(
  items: MenuServing[],
  profile: PersonalizationProfile,
) {
  return items
    .map((item, index) => ({
      item,
      index,
      score: ingredientPreferenceSortScore(item.meal.ingredients, profile),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

function ingredientPreferenceSortScore(
  ingredients: string[],
  profile: PersonalizationProfile,
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

  return (
    Math.min(preferredMatches, PREFERRED_INGREDIENT_MATCH_CAP) *
      PREFERRED_INGREDIENT_SORT_BOOST -
    Math.min(dislikedMatches, DISLIKED_INGREDIENT_MATCH_CAP) *
      DISLIKED_INGREDIENT_SORT_PENALTY
  );
}

function countPreferenceMatches(ingredients: string[], preferences: string[]) {
  if (preferences.length === 0) return 0;

  return preferences.filter((preference) =>
    ingredients.some((ingredient) => ingredientsMatchPreference(ingredient, preference)),
  ).length;
}

function ingredientsMatchPreference(ingredient: string, preference: string) {
  if (!ingredient || !preference) return false;
  if (ingredient === preference) return true;
  if (ingredient.includes(preference) || preference.includes(ingredient)) return true;
  return new RegExp(`(^|\\s)${escapeRegExp(preference)}(\\s|$)`).test(ingredient);
}

function normalizeIngredientList(value: unknown) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map(normalizeIngredientText)
        .filter(Boolean),
    ),
  ];
}

function normalizeIngredientText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
