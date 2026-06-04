// Domain models mirroring the MongoDB collections in
// team17_mongodb_api_spec.md §1. Object ids are serialized to strings on the
// wire.

import type {
  AllergyCode,
  CategoryCode,
  DietaryLabelCode,
  MealTime,
  MenuServingStatus,
  NotificationResourceType,
  NotificationType,
  ReceiptStatus,
  UserRole,
} from "./enums";

export type DietaryProfile = {
  allergies: AllergyCode[];
  preferredIngredients: string[];
  dislikedIngredients: string[];
  dietaryLabels: DietaryLabelCode[];
};

export type User = {
  id: string;
  email: string;
  nickname: string;
  role: UserRole;
  isEmailVerified: boolean;
  dietaryProfile: DietaryProfile;
  reviewStats: {
    verifiedReviewCount: number;
  };
};

export type UserProfile = Omit<User, "isEmailVerified">;

export type TimeRange = {
  open: string;
  close: string;
};

export type WeeklyOpeningHours = Partial<
  Record<
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday",
    TimeRange[]
  >
>;

export type CafeteriaLocation = {
  building?: string;
  floor?: string;
  address?: string;
  lat?: number;
  lng?: number;
};

export type Cafeteria = {
  id: string;
  name: string;
  description?: string;
  location: CafeteriaLocation;
  openingHours: WeeklyOpeningHours;
  isActive?: boolean;
};

export type NutritionFacts = {
  calories?: number;
  carbohydrate?: number;
  protein?: number;
  fat?: number;
  sodium?: number;
};

export type Meal = {
  id: string;
  name: string;
  description?: string;
  category: CategoryCode;
  imageUrl?: string;
  ingredients: string[];
  allergens: AllergyCode[];
  dietaryLabels: DietaryLabelCode[];
  nutrition: NutritionFacts;
};

export type FavoriteMeal = {
  id: string;
  mealId: string;
  meal?: Pick<
    Meal,
    "id" | "name" | "category" | "imageUrl" | "dietaryLabels" | "allergens"
  >;
  createdAt?: string;
};

export type AllergyWarning = {
  hasConflict: boolean;
  matchedAllergens: AllergyCode[];
};

export type MenuServing = {
  id: string;
  date: string;
  mealTime: MealTime;
  price: number;
  status: MenuServingStatus;
  stock?: number;
  averageRating: number;
  verifiedReviewCount: number;
  cafeteria: Pick<Cafeteria, "id" | "name">;
  meal: Pick<
    Meal,
    | "id"
    | "name"
    | "category"
    | "imageUrl"
    | "ingredients"
    | "allergens"
    | "dietaryLabels"
  >;
  allergyWarning?: AllergyWarning;
};

export type MenuServingDetail = Omit<MenuServing, "cafeteria" | "meal"> & {
  stock?: number;
  cafeteria: Pick<
    Cafeteria,
    "id" | "name" | "description" | "location" | "openingHours"
  >;
  meal: Meal;
};

export type DetailRatings = {
  taste: number;
  price: number;
  portion: number;
};

export type ManagerReply = {
  managerId?: string;
  content: string;
  repliedAt: string;
  updatedAt?: string;
};

export type Review = {
  id: string;
  userId?: string;
  reviewerDisplayName?: string;
  mealId: string;
  menuServingId: string;
  cafeteriaId: string;
  receiptId?: string;
  isVerified: boolean;
  rating: number;
  detailRatings: DetailRatings;
  content?: string;
  managerReply?: ManagerReply;
  createdAt: string;
};

export type Receipt = {
  id: string;
  status: ReceiptStatus;
  parsed: {
    purchasedAt?: string;
    cafeteriaName?: string;
    mealNames?: string[];
    totalPrice?: number;
  };
  matchedMenuServings: Array<{
    id: string;
    mealName: string;
    cafeteriaName: string;
    date: string;
    price: number;
  }>;
  confirmedMenuServingId?: string;
  usedForReview: boolean;
  reviewId?: string;
  rejectReason?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type LoginResponse = AuthTokens & {
  user: Pick<User, "id" | "email" | "nickname" | "role" | "isEmailVerified">;
};

export type WeeklyBestItem = {
  menuServingId: string;
  mealName: string;
  cafeteriaName: string;
  averageRating: number;
  verifiedReviewCount: number;
  positiveReviewCount: number;
  score: number;
};

export type CafeteriaRankItem = {
  cafeteriaId: string;
  cafeteriaName: string;
  averageRating: number;
  verifiedReviewCount: number;
  positiveReviewCount: number;
  rank: number;
};

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  resourceType?: NotificationResourceType;
  resourceId?: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationUnreadCount = {
  unreadCount: number;
};
