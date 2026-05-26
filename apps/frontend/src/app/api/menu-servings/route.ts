import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../_utils";
import { mockMenuServings, mockUser } from "@/mocks/data";
import { okJson } from "@/mocks/respond";
import type { AllergyCode, DietaryLabelCode, MenuServing } from "@/types";

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

  let filtered = mockMenuServings.slice();

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
    filtered = filtered.filter((m) => m.meal.name.toLowerCase().includes(q));
  }

  const decorated: MenuServing[] = filtered.map((serving) => {
    const matchedAllergens = serving.meal.allergens.filter((a) =>
      userAllergies.includes(a),
    );
    return {
      ...serving,
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

  const paged = items.slice(offset, offset + limit);

  return okJson({
    items: paged,
    page,
    limit,
    total: items.length,
  });
}
