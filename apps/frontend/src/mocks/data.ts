// Static fixture data used by the in-app mock API. Numbers and ids are
// intentionally fixed so dev sessions stay reproducible across reloads.

import type {
  Cafeteria,
  Meal,
  MenuServing,
  Receipt,
  Review,
  User,
} from "@/types";
import { todayInSeoul } from "@/lib/date";

const TODAY = todayInSeoul();

export const mockUser: User = {
  id: "u_demo_student",
  email: "demo@kaist.ac.kr",
  nickname: "Demo Student",
  role: "USER",
  isEmailVerified: true,
  dietaryProfile: {
    allergies: ["EGG"],
    preferredIngredients: ["chicken"],
    dislikedIngredients: ["onion"],
    dietaryLabels: ["NO_BEEF"],
  },
  reviewStats: {
    verifiedReviewCount: 2,
  },
};

export const mockCafeterias: Cafeteria[] = [
  {
    id: "c_kaimaru",
    name: "Kaimaru",
    description: "Student union cafeteria, N11 1F.",
    location: { building: "N11", floor: "1F", lat: 36.3736, lng: 127.3608 },
    openingHours: {
      monday: [{ open: "11:30", close: "13:30" }, { open: "17:30", close: "19:00" }],
      tuesday: [{ open: "11:30", close: "13:30" }, { open: "17:30", close: "19:00" }],
      wednesday: [{ open: "11:30", close: "13:30" }, { open: "17:30", close: "19:00" }],
      thursday: [{ open: "11:30", close: "13:30" }, { open: "17:30", close: "19:00" }],
      friday: [{ open: "11:30", close: "13:30" }, { open: "17:30", close: "19:00" }],
    },
    isActive: true,
  },
  {
    id: "c_north",
    name: "North Cafeteria",
    description: "Grad student favourite, W2.",
    location: { building: "W2", floor: "B1", lat: 36.3745, lng: 127.3621 },
    openingHours: {
      monday: [{ open: "07:30", close: "09:30" }, { open: "11:30", close: "13:30" }],
      tuesday: [{ open: "07:30", close: "09:30" }, { open: "11:30", close: "13:30" }],
      wednesday: [{ open: "07:30", close: "09:30" }, { open: "11:30", close: "13:30" }],
      thursday: [{ open: "07:30", close: "09:30" }, { open: "11:30", close: "13:30" }],
      friday: [{ open: "07:30", close: "09:30" }, { open: "11:30", close: "13:30" }],
    },
    isActive: true,
  },
];

export const mockMeals: Meal[] = [
  {
    id: "m_mackerel_set",
    name: "Mackerel Set",
    description: "Grilled mackerel with rice and side dishes.",
    category: "KOREAN",
    imageUrl: undefined,
    ingredients: ["mackerel", "rice", "kimchi", "soybean paste soup"],
    allergens: ["MACKEREL", "SOYBEAN"],
    dietaryLabels: ["NO_BEEF", "NO_PORK"],
    nutrition: { calories: 620, carbohydrate: 70, protein: 35, fat: 18, sodium: 900 },
  },
  {
    id: "m_chicken_curry",
    name: "Chicken Curry",
    description: "Mild curry rice with chicken thigh.",
    category: "ASIAN",
    ingredients: ["chicken", "rice", "curry roux", "carrot", "onion"],
    allergens: ["CHICKEN", "WHEAT"],
    dietaryLabels: ["NO_BEEF", "NO_PORK"],
    nutrition: { calories: 740, carbohydrate: 95, protein: 30, fat: 22, sodium: 1100 },
  },
  {
    id: "m_garden_salad",
    name: "Garden Salad",
    description: "Mixed leaves with balsamic dressing.",
    category: "SALAD",
    ingredients: ["lettuce", "tomato", "cucumber", "balsamic"],
    allergens: ["TOMATO"],
    dietaryLabels: ["VEGAN", "VEGETARIAN", "HALAL"],
    nutrition: { calories: 220, carbohydrate: 18, protein: 6, fat: 12, sodium: 320 },
  },
  {
    id: "m_pasta_carbonara",
    name: "Pasta Carbonara",
    description: "Creamy carbonara with bacon.",
    category: "WESTERN",
    ingredients: ["pasta", "egg", "bacon", "cream"],
    allergens: ["EGG", "MILK", "WHEAT", "PORK"],
    dietaryLabels: ["NO_BEEF"],
    nutrition: { calories: 820, carbohydrate: 80, protein: 28, fat: 38, sodium: 1300 },
  },
];

export const mockMenuServings: MenuServing[] = [
  {
    id: "ms_kaimaru_mackerel_lunch",
    date: TODAY,
    mealTime: "LUNCH",
    price: 4900,
    status: "AVAILABLE",
    averageRating: 4.5,
    verifiedReviewCount: 12,
    cafeteria: { id: "c_kaimaru", name: "Kaimaru" },
    meal: pickMealCard("m_mackerel_set"),
  },
  {
    id: "ms_kaimaru_curry_lunch",
    date: TODAY,
    mealTime: "LUNCH",
    price: 5200,
    status: "AVAILABLE",
    averageRating: 4.2,
    verifiedReviewCount: 8,
    cafeteria: { id: "c_kaimaru", name: "Kaimaru" },
    meal: pickMealCard("m_chicken_curry"),
  },
  {
    id: "ms_north_salad_lunch",
    date: TODAY,
    mealTime: "LUNCH",
    price: 4500,
    status: "AVAILABLE",
    averageRating: 4.0,
    verifiedReviewCount: 5,
    cafeteria: { id: "c_north", name: "North Cafeteria" },
    meal: pickMealCard("m_garden_salad"),
  },
  {
    id: "ms_kaimaru_pasta_dinner",
    date: TODAY,
    mealTime: "DINNER",
    price: 6200,
    status: "SOLD_OUT",
    averageRating: 4.3,
    verifiedReviewCount: 17,
    cafeteria: { id: "c_kaimaru", name: "Kaimaru" },
    meal: pickMealCard("m_pasta_carbonara"),
  },
];

export const mockReviews: Review[] = [
  {
    id: "rev_001",
    userId: "u_other_1",
    mealId: "m_mackerel_set",
    menuServingId: "ms_kaimaru_mackerel_lunch",
    cafeteriaId: "c_kaimaru",
    receiptId: "rcp_001",
    isVerified: true,
    rating: 5,
    detailRatings: { taste: 5, price: 4, portion: 5 },
    content: "Really fresh mackerel today. Kimchi was perfectly fermented. Highly recommend!",
    createdAt: "2025-05-26T12:30:00.000Z",
  },
  {
    id: "rev_002",
    userId: "u_other_2",
    mealId: "m_mackerel_set",
    menuServingId: "ms_kaimaru_mackerel_lunch",
    cafeteriaId: "c_kaimaru",
    receiptId: "rcp_002",
    isVerified: true,
    rating: 4,
    detailRatings: { taste: 4, price: 4, portion: 3 },
    content: "Good but portion was a bit small today.",
    managerReply: {
      managerId: "mgr_kaimaru",
      content: "Thank you for the feedback! We'll work on improving portion size.",
      repliedAt: "2025-05-26T15:00:00.000Z",
    },
    createdAt: "2025-05-25T13:00:00.000Z",
  },
  {
    id: "rev_003",
    userId: "u_demo_student",
    mealId: "m_chicken_curry",
    menuServingId: "ms_kaimaru_curry_lunch",
    cafeteriaId: "c_kaimaru",
    receiptId: "rcp_003",
    isVerified: true,
    rating: 4,
    detailRatings: { taste: 4, price: 5, portion: 4 },
    content: "Great value for the price. Curry was mild but tasty.",
    createdAt: "2025-05-24T12:45:00.000Z",
  },
];

export const mockReceipts: Receipt[] = [
  {
    id: "rcp_003",
    status: "USED",
    parsed: {
      purchasedAt: "2025-05-24T12:30:00.000Z",
      cafeteriaName: "Kaimaru",
      mealNames: ["Chicken Curry"],
      totalPrice: 5200,
    },
    matchedMenuServings: [
      {
        id: "ms_kaimaru_curry_lunch",
        mealName: "Chicken Curry",
        cafeteriaName: "Kaimaru",
        date: "2025-05-24",
        price: 5200,
      },
    ],
    confirmedMenuServingId: "ms_kaimaru_curry_lunch",
    usedForReview: true,
    reviewId: "rev_003",
  },
];

function pickMealCard(id: string): MenuServing["meal"] {
  const meal = mockMeals.find((m) => m.id === id);
  if (!meal) {
    throw new Error(`mock meal ${id} not found`);
  }
  return {
    id: meal.id,
    name: meal.name,
    category: meal.category,
    imageUrl: meal.imageUrl,
    ingredients: meal.ingredients,
    allergens: meal.allergens,
    dietaryLabels: meal.dietaryLabels,
  };
}
