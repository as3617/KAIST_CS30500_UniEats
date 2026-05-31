export enum AllergyCode {
  EGG = "EGG",
  MILK = "MILK",
  BUCKWHEAT = "BUCKWHEAT",
  PEANUT = "PEANUT",
  SOYBEAN = "SOYBEAN",
  WHEAT = "WHEAT",
  MACKEREL = "MACKEREL",
  CRAB = "CRAB",
  SHRIMP = "SHRIMP",
  PORK = "PORK",
  PEACH = "PEACH",
  TOMATO = "TOMATO",
  SULFITES = "SULFITES",
  WALNUT = "WALNUT",
  CHICKEN = "CHICKEN",
  BEEF = "BEEF",
  SQUID = "SQUID",
  SHELLFISH = "SHELLFISH",
  PINE_NUT = "PINE_NUT",
}

export enum DietaryLabelCode {
  HALAL = "HALAL",
  VEGETARIAN = "VEGETARIAN",
  VEGAN = "VEGAN",
  PESCATARIAN = "PESCATARIAN",
  LACTO_VEGETARIAN = "LACTO_VEGETARIAN",
  OVO_VEGETARIAN = "OVO_VEGETARIAN",
  LACTO_OVO_VEGETARIAN = "LACTO_OVO_VEGETARIAN",
  NO_PORK = "NO_PORK",
  NO_BEEF = "NO_BEEF",
}

export enum CategoryCode {
  KOREAN = "KOREAN",
  WESTERN = "WESTERN",
  CHINESE = "CHINESE",
  JAPANESE = "JAPANESE",
  ASIAN = "ASIAN",
  SALAD = "SALAD",
  SNACK = "SNACK",
  DESSERT = "DESSERT",
  BEVERAGE = "BEVERAGE",
  OTHER = "OTHER",
}

export enum UserRole {
  USER = "USER",
  MANAGER = "MANAGER",
  ADMIN = "ADMIN",
}

export enum AuthTokenType {
  EMAIL_VERIFY = "EMAIL_VERIFY",
  PASSWORD_RESET = "PASSWORD_RESET",
  REFRESH_TOKEN = "REFRESH_TOKEN",
}

export enum MealTime {
  BREAKFAST = "BREAKFAST",
  LUNCH = "LUNCH",
  DINNER = "DINNER",
  ALL_DAY = "ALL_DAY",
}

export enum MenuServingStatus {
  AVAILABLE = "AVAILABLE",
  SOLD_OUT = "SOLD_OUT",
  HIDDEN = "HIDDEN",
}

export enum MenuSource {
  DAILY_MENU = "DAILY_MENU",
  FIXED_MENU = "FIXED_MENU",
}

export enum OcrProvider {
  FAKE = "FAKE",
  CLOVA = "CLOVA",
  GOOGLE_VISION = "GOOGLE_VISION",
}

export enum ReceiptStatus {
  UPLOADED = "UPLOADED",
  OCR_PROCESSING = "OCR_PROCESSING",
  NEED_CONFIRMATION = "NEED_CONFIRMATION",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  USED = "USED",
}

export enum ManagerRole {
  OWNER = "OWNER",
  STAFF = "STAFF",
}

export enum ManagerPermission {
  MENU_WRITE = "MENU_WRITE",
  STATUS_WRITE = "STATUS_WRITE",
  REVIEW_REPLY = "REVIEW_REPLY",
  ANALYTICS_READ = "ANALYTICS_READ",
}

export const ALLERGY_CODES = Object.values(AllergyCode);
export const DIETARY_LABEL_CODES = Object.values(DietaryLabelCode);
export const CATEGORY_CODES = Object.values(CategoryCode);
export const USER_ROLES = Object.values(UserRole);
export const AUTH_TOKEN_TYPES = Object.values(AuthTokenType);
export const MEAL_TIMES = Object.values(MealTime);
export const MENU_SERVING_STATUSES = Object.values(MenuServingStatus);
export const MENU_SOURCES = Object.values(MenuSource);
export const OCR_PROVIDERS = Object.values(OcrProvider);
export const RECEIPT_STATUSES = Object.values(ReceiptStatus);
export const MANAGER_ROLES = Object.values(ManagerRole);
export const MANAGER_PERMISSIONS = Object.values(ManagerPermission);
