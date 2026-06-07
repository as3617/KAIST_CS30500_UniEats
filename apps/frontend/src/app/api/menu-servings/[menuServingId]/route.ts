import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { mockCafeterias, mockUser } from "@/mocks/data";
import { discountsStore, mealsStore, menuServingsStore } from "@/mocks/store";
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

  const serving = menuServingsStore.find((item) => item.id === params.menuServingId);
  if (!serving) {
    return errorJson(404, "NOT_FOUND", "menu serving not found");
  }

  const cafeteria = mockCafeterias.find((item) => item.id === serving.cafeteria.id);
  const meal = mealsStore.find((item) => item.id === serving.meal.id);
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
    activeDiscount: findActiveDiscountForServing(serving.id),
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

function findActiveDiscountForServing(menuServingId: string) {
  const now = new Date().toISOString();
  const discount = discountsStore
    .filter(
      (item) =>
        item.isActive &&
        item.menuServingId === menuServingId &&
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
