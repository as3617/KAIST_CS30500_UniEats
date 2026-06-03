import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { mockCafeterias } from "@/mocks/data";
import { mealsStore, menuServingsStore } from "@/mocks/store";
import { createdJson, errorJson } from "@/mocks/respond";
import {
  ALLERGY_CODES,
  CATEGORY_CODES,
  DIETARY_LABEL_CODES,
  MEAL_TIMES,
  MENU_SERVING_STATUSES,
} from "@/types";
import type {
  AllergyCode,
  CategoryCode,
  DietaryLabelCode,
  Meal,
  MealTime,
  MenuServing,
  MenuServingStatus,
} from "@/types";

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
  if (!body.meal || typeof body.meal !== "object" || Array.isArray(body.meal)) {
    return errorJson(400, "VALIDATION_ERROR", "meal must be an object");
  }

  const cafeteria = mockCafeterias.find((item) => item.id === body.cafeteriaId);
  if (!cafeteria) return errorJson(404, "NOT_FOUND", "cafeteria not found");

  const date = requiredDate(body.date);
  if (!date) {
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

  const mealBody = body.meal as Record<string, unknown>;
  const mealName = requiredString(mealBody.name);
  if (!mealName) return errorJson(400, "VALIDATION_ERROR", "meal.name is required");

  const category = mealBody.category;
  if (typeof category !== "string" || !CATEGORY_CODES.includes(category as CategoryCode)) {
    return errorJson(400, "VALIDATION_ERROR", "valid meal.category is required");
  }

  const ingredients = stringArray(mealBody.ingredients);
  if (!ingredients) {
    return errorJson(400, "VALIDATION_ERROR", "meal.ingredients must be an array");
  }
  const allergens = enumArray<AllergyCode>(mealBody.allergens, ALLERGY_CODES);
  if (!allergens) {
    return errorJson(400, "VALIDATION_ERROR", "meal.allergens contains invalid value");
  }
  const dietaryLabels = enumArray<DietaryLabelCode>(
    mealBody.dietaryLabels,
    DIETARY_LABEL_CODES,
  );
  if (!dietaryLabels) {
    return errorJson(
      400,
      "VALIDATION_ERROR",
      "meal.dietaryLabels contains invalid value",
    );
  }
  const nutrition = nutritionObject(mealBody.nutrition);
  if (!nutrition) {
    return errorJson(400, "VALIDATION_ERROR", "meal.nutrition must be valid");
  }

  const duplicate = menuServingsStore.find(
    (serving) =>
      serving.cafeteria.id === cafeteria.id &&
      serving.date === date &&
      serving.mealTime === mealTime &&
      serving.meal.name.toLowerCase() === mealName.toLowerCase(),
  );
  if (duplicate) {
    return errorJson(409, "CONFLICT", "menu serving already exists");
  }

  const now = Date.now();
  const meal: Meal = {
    id: `m_custom_${now}`,
    name: mealName,
    description: optionalString(mealBody.description),
    category: category as CategoryCode,
    imageUrl: optionalString(mealBody.imageUrl),
    ingredients,
    allergens,
    dietaryLabels,
    nutrition,
  };
  const serving: MenuServing = {
    id: `ms_custom_${now}`,
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

  mealsStore.push(meal);
  menuServingsStore.push(serving);
  return createdJson(serving, "Menu serving created");
}

function requiredDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return value;
}

function requiredString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function optionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function stringArray(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const values: string[] = [];
  for (const item of value) {
    const normalized = requiredString(item);
    if (!normalized) return null;
    if (!values.includes(normalized)) values.push(normalized);
  }
  return values;
}

function enumArray<T extends string>(value: unknown, allowedValues: readonly T[]) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const allowed = new Set<string>(allowedValues);
  const values: T[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !allowed.has(item)) return null;
    if (!values.includes(item as T)) values.push(item as T);
  }
  return values;
}

function nutritionObject(value: unknown): Meal["nutrition"] | null {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const input = value as Record<string, unknown>;
  const nutrition: Meal["nutrition"] = {};
  for (const field of ["calories", "carbohydrate", "protein", "fat", "sodium"] as const) {
    if (!(field in input)) continue;
    const numberValue = input[field];
    if (typeof numberValue !== "number" || !Number.isFinite(numberValue) || numberValue < 0) {
      return null;
    }
    nutrition[field] = numberValue;
  }
  return nutrition;
}
