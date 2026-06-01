// Mutable in-process state for the mock API. Uses globalThis to survive
// Next.js hot-module reloads in development without losing added entries.

import type { Meal, MenuServing, Receipt, Review } from "@/types";
import { mockMeals, mockMenuServings, mockReceipts, mockReviews } from "./data";

declare global {
  // eslint-disable-next-line no-var
  var __receiptsStore: Receipt[] | undefined;
  // eslint-disable-next-line no-var
  var __reviewsStore: Review[] | undefined;
  // eslint-disable-next-line no-var
  var __menuServingsStore: MenuServing[] | undefined;
  // eslint-disable-next-line no-var
  var __mealsStore: Meal[] | undefined;
}

globalThis.__mealsStore ??= mockMeals.map((meal) => ({
  ...meal,
  ingredients: [...meal.ingredients],
  allergens: [...meal.allergens],
  dietaryLabels: [...meal.dietaryLabels],
  nutrition: { ...meal.nutrition },
}));
globalThis.__receiptsStore ??= [...mockReceipts];
globalThis.__reviewsStore ??= [...mockReviews];
globalThis.__menuServingsStore ??= mockMenuServings.map((serving) => ({
  ...serving,
  cafeteria: { ...serving.cafeteria },
  meal: { ...serving.meal },
}));

export const receiptsStore: Receipt[] = globalThis.__receiptsStore;
export const reviewsStore: Review[] = globalThis.__reviewsStore;
export const menuServingsStore: MenuServing[] = globalThis.__menuServingsStore;
export const mealsStore: Meal[] = globalThis.__mealsStore;
