// Shared enum codes from team17_mongodb_api_spec.md §1.0
// Keep this file in sync with the backend's enum definitions.

export const ALLERGY_CODES = [
  "EGG",
  "MILK",
  "BUCKWHEAT",
  "PEANUT",
  "SOYBEAN",
  "WHEAT",
  "MACKEREL",
  "CRAB",
  "SHRIMP",
  "PORK",
  "PEACH",
  "TOMATO",
  "SULFITES",
  "WALNUT",
  "CHICKEN",
  "BEEF",
  "SQUID",
  "SHELLFISH",
  "PINE_NUT",
] as const;
export type AllergyCode = (typeof ALLERGY_CODES)[number];

export const DIETARY_LABEL_CODES = [
  "HALAL",
  "VEGETARIAN",
  "VEGAN",
  "PESCATARIAN",
  "LACTO_VEGETARIAN",
  "OVO_VEGETARIAN",
  "LACTO_OVO_VEGETARIAN",
  "NO_PORK",
  "NO_BEEF",
] as const;
export type DietaryLabelCode = (typeof DIETARY_LABEL_CODES)[number];

export const CATEGORY_CODES = [
  "KOREAN",
  "WESTERN",
  "CHINESE",
  "JAPANESE",
  "ASIAN",
  "SALAD",
  "SNACK",
  "DESSERT",
  "BEVERAGE",
  "OTHER",
] as const;
export type CategoryCode = (typeof CATEGORY_CODES)[number];

export const MEAL_TIMES = ["BREAKFAST", "LUNCH", "DINNER", "ALL_DAY"] as const;
export type MealTime = (typeof MEAL_TIMES)[number];

export const MENU_SERVING_STATUSES = ["AVAILABLE", "SOLD_OUT", "HIDDEN"] as const;
export type MenuServingStatus = (typeof MENU_SERVING_STATUSES)[number];

export type UserRole = "USER" | "MANAGER" | "ADMIN";

export type ReceiptStatus =
  | "UPLOADED"
  | "OCR_PROCESSING"
  | "NEED_CONFIRMATION"
  | "VERIFIED"
  | "REJECTED"
  | "USED";

// Human-readable labels are kept here so UI code can stay enum-driven and
// localized in one place later.
export const ALLERGY_LABELS: Record<AllergyCode, string> = {
  EGG: "Egg",
  MILK: "Milk",
  BUCKWHEAT: "Buckwheat",
  PEANUT: "Peanut",
  SOYBEAN: "Soybean",
  WHEAT: "Wheat",
  MACKEREL: "Mackerel",
  CRAB: "Crab",
  SHRIMP: "Shrimp",
  PORK: "Pork",
  PEACH: "Peach",
  TOMATO: "Tomato",
  SULFITES: "Sulfites",
  WALNUT: "Walnut",
  CHICKEN: "Chicken",
  BEEF: "Beef",
  SQUID: "Squid",
  SHELLFISH: "Shellfish",
  PINE_NUT: "Pine nut",
};

export const CATEGORY_LABELS: Record<CategoryCode, string> = {
  KOREAN: "Korean",
  WESTERN: "Western",
  CHINESE: "Chinese",
  JAPANESE: "Japanese",
  ASIAN: "Asian",
  SALAD: "Salad",
  SNACK: "Snack",
  DESSERT: "Dessert",
  BEVERAGE: "Beverage",
  OTHER: "Other",
};

export const DIETARY_LABELS: Record<DietaryLabelCode, string> = {
  HALAL: "Halal",
  VEGETARIAN: "Vegetarian",
  VEGAN: "Vegan",
  PESCATARIAN: "Pescatarian",
  LACTO_VEGETARIAN: "Lacto vegetarian",
  OVO_VEGETARIAN: "Ovo vegetarian",
  LACTO_OVO_VEGETARIAN: "Lacto-ovo vegetarian",
  NO_PORK: "No pork",
  NO_BEEF: "No beef",
};

export const MEAL_TIME_LABELS: Record<MealTime, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  ALL_DAY: "All day",
};
