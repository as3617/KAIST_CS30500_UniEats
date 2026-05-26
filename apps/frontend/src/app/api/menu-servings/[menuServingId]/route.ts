import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { mockCafeterias, mockMeals, mockMenuServings, mockUser } from "@/mocks/data";
import { errorJson, okJson } from "@/mocks/respond";
import type { AllergyCode, MenuServingDetail } from "@/types";

type RouteParams = {
  params: {
    menuServingId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!shouldUseMockApi()) {
    return proxyToBackend(request);
  }

  const serving = mockMenuServings.find((item) => item.id === params.menuServingId);
  if (!serving) {
    return errorJson(404, "NOT_FOUND", "menu serving not found");
  }

  const cafeteria = mockCafeterias.find((item) => item.id === serving.cafeteria.id);
  const meal = mockMeals.find((item) => item.id === serving.meal.id);
  if (!cafeteria || !meal) {
    return errorJson(404, "NOT_FOUND", "menu serving not found");
  }

  const isAuthenticated = (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
  const userAllergies: AllergyCode[] = isAuthenticated
    ? mockUser.dietaryProfile.allergies
    : [];
  const matchedAllergens = meal.allergens.filter((allergen) =>
    userAllergies.includes(allergen),
  );

  const detail: MenuServingDetail = {
    ...serving,
    cafeteria,
    meal,
    allergyWarning: isAuthenticated
      ? {
          hasConflict: matchedAllergens.length > 0,
          matchedAllergens,
        }
      : undefined,
  };

  return okJson(detail);
}
