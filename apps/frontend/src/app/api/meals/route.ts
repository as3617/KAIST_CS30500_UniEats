import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../_utils";
import { mealsStore } from "@/mocks/store";
import { createdJson, errorJson, okJson } from "@/mocks/respond";
import {
  ALLERGY_CODES,
  CATEGORY_CODES,
  DIETARY_LABEL_CODES,
} from "@/types";
import type {
  AllergyCode,
  CategoryCode,
  DietaryLabelCode,
  Meal,
  PaginatedData,
} from "@/types";

type MealCreateBody = {
  name?: unknown;
  description?: unknown;
  category?: unknown;
  imageUrl?: unknown;
  ingredients?: unknown;
  allergens?: unknown;
  dietaryLabels?: unknown;
  nutrition?: unknown;
};

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const sp = request.nextUrl.searchParams;
  const query = {
    q: sp.get("q")?.toLowerCase() ?? "",
    category: sp.get("category") ?? "",
    dietaryLabel: sp.get("dietaryLabel") ?? "",
    page: Number(sp.get("page") ?? 1) || 1,
    limit: Number(sp.get("limit") ?? 20) || 20,
  };
  const offset = (query.page - 1) * query.limit;

  let filtered = mealsStore.slice();
  if (query.q) {
    filtered = filtered.filter((meal) =>
      [meal.name, meal.description, ...meal.ingredients]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query.q),
    );
  }
  if (query.category) {
    filtered = filtered.filter((meal) => meal.category === query.category);
  }
  if (query.dietaryLabel) {
    filtered = filtered.filter((meal) =>
      meal.dietaryLabels.includes(query.dietaryLabel as DietaryLabelCode),
    );
  }

  const result: PaginatedData<Meal> = {
    items: filtered.slice(offset, offset + query.limit),
    page: query.page,
    limit: query.limit,
    total: filtered.length,
  };
  return okJson(result);
}

export async function POST(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const isAuthenticated = (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
  if (!isAuthenticated) return errorJson(401, "UNAUTHORIZED", "sign in required");

  const body = (await request.json().catch(() => null)) as MealCreateBody | null;
  if (!body || typeof body !== "object") {
    return errorJson(400, "VALIDATION_ERROR", "request body is required");
  }

  const name = normalizeOptionalString(body.name);
  if (!name) return errorJson(400, "VALIDATION_ERROR", "name is required");

  const category = body.category;
  if (typeof category !== "string" || !CATEGORY_CODES.includes(category as CategoryCode)) {
    return errorJson(400, "VALIDATION_ERROR", "valid category is required");
  }

  const ingredients = normalizeStringArray(body.ingredients);
  if (ingredients.length === 0) {
    return errorJson(400, "VALIDATION_ERROR", "ingredients are required");
  }

  const allergens = normalizeEnumArray<AllergyCode>(
    body.allergens,
    ALLERGY_CODES,
  );
  const dietaryLabels = normalizeEnumArray<DietaryLabelCode>(
    body.dietaryLabels,
    DIETARY_LABEL_CODES,
  );

  if (!allergens || !dietaryLabels) {
    return errorJson(400, "VALIDATION_ERROR", "allergens or dietary labels contain invalid values");
  }

  const meal: Meal = {
    id: `m_custom_${Date.now()}`,
    name,
    description: normalizeOptionalString(body.description),
    category: category as CategoryCode,
    imageUrl: normalizeOptionalString(body.imageUrl),
    ingredients,
    allergens,
    dietaryLabels,
    nutrition: normalizeNutrition(body.nutrition),
  };

  mealsStore.push(meal);
  return createdJson(meal, "Meal created");
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  ];
}

function normalizeEnumArray<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
): T[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const normalized: T[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !allowedValues.includes(item as T)) {
      return null;
    }
    if (!normalized.includes(item as T)) {
      normalized.push(item as T);
    }
  }
  return normalized;
}

function normalizeNutrition(value: unknown): Meal["nutrition"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const source = value as Record<string, unknown>;
  const nutrition: Meal["nutrition"] = {};
  for (const field of ["calories", "carbohydrate", "protein", "fat", "sodium"] as const) {
    const numberValue = source[field];
    if (typeof numberValue === "number" && Number.isFinite(numberValue) && numberValue >= 0) {
      nutrition[field] = numberValue;
    }
  }
  return nutrition;
}
