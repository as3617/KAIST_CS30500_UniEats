// Static fixture data used by the in-app mock API. Numbers and ids are
// intentionally fixed so dev sessions stay reproducible across reloads.

import type {
  Cafeteria,
  Discount,
  FavoriteMeal,
  Meal,
  MenuServing,
  Notification,
  Receipt,
  Review,
  User,
} from "@/types";
import { todayInSeoul } from "@/lib/date";

const TODAY = todayInSeoul();

const weekdayOpeningHours = (
  ranges: Array<{ open: string; close: string }>,
): Cafeteria["openingHours"] => ({
  monday: ranges,
  tuesday: ranges,
  wednesday: ranges,
  thursday: ranges,
  friday: ranges,
});

const breakfastLunchDinner = weekdayOpeningHours([
  { open: "08:00", close: "09:00" },
  { open: "11:20", close: "13:30" },
  { open: "17:20", close: "19:00" },
]);

const kaimaruFoodCourtHours = weekdayOpeningHours([{ open: "10:30", close: "20:00" }]);
const eastStudentHours = weekdayOpeningHours([
  { open: "08:00", close: "10:00" },
  { open: "11:30", close: "14:00" },
  { open: "17:30", close: "19:00" },
]);
const eastFacultyHours = weekdayOpeningHours([
  { open: "11:30", close: "13:30" },
  { open: "17:30", close: "19:00" },
]);
const facultyHallHours = weekdayOpeningHours([
  { open: "11:20", close: "13:30" },
  { open: "17:30", close: "18:30" },
]);

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
    name: "카이마루(북측 카페테리아)",
    description: "KAIST 학생식당(N11) 1층 북측 카페테리아.",
    location: { building: "N11", floor: "1F", lat: 36.37379, lng: 127.35925 },
    openingHours: breakfastLunchDinner,
    isActive: true,
  },
  {
    id: "c_west",
    name: "서맛골(서측식당)",
    description: "서측 학생회관(W2) 1층 식당.",
    location: { building: "W2", floor: "1F", lat: 36.36734, lng: 127.36097 },
    openingHours: weekdayOpeningHours([
      { open: "08:00", close: "09:30" },
      { open: "11:30", close: "13:30" },
      { open: "17:00", close: "19:00" },
    ]),
    isActive: true,
  },
  {
    id: "c_east_student",
    name: "동맛골(동측 학생식당)",
    description: "교직원회관(E5) 1층 동측 학생식당.",
    location: { building: "E5", floor: "1F", lat: 36.36926, lng: 127.3636 },
    openingHours: eastStudentHours,
    isActive: true,
  },
  {
    id: "c_east_faculty",
    name: "동맛골(동측 교직원식당)",
    description: "교직원회관(E5) 2층 동측 교직원식당.",
    location: { building: "E5", floor: "2F", lat: 36.36926, lng: 127.3636 },
    openingHours: eastFacultyHours,
    isActive: true,
  },
  {
    id: "c_faculty_hall",
    name: "교수회관",
    description: "교수회관(N6) 1~2층 식당.",
    location: { building: "N6", floor: "1-2F", lat: 36.37474, lng: 127.36474 },
    openingHours: facultyHallHours,
    isActive: true,
  },
  {
    id: "c_munji",
    name: "문지캠퍼스 구내식당",
    description: "문지캠퍼스 구내식당.",
    location: {
      building: "Munji Campus",
      floor: "1F",
      address: "193 Munji-ro, Yuseong-gu, Daejeon",
      lat: 36.39274,
      lng: 127.39912,
    },
    openingHours: weekdayOpeningHours([
      { open: "07:30", close: "09:00" },
      { open: "11:00", close: "13:00" },
      { open: "17:00", close: "18:40" },
    ]),
    isActive: true,
  },
  {
    id: "c_hwaam",
    name: "화암 기숙사 식당",
    description: "화암 기숙사 내 구내식당.",
    location: { building: "Hwaam Dormitory", floor: "1F", lat: 36.40803, lng: 127.38144 },
    openingHours: weekdayOpeningHours([
      { open: "07:30", close: "09:00" },
      { open: "11:30", close: "13:00" },
      { open: "17:30", close: "18:40" },
    ]),
    isActive: true,
  },
  {
    id: "c_seoul",
    name: "서울캠퍼스 구내식당",
    description: "KAIST 서울캠퍼스 구내식당.",
    location: {
      building: "Seoul Campus",
      floor: "1F",
      address: "85 Hoegi-ro, Dongdaemun-gu, Seoul",
      lat: 37.5918,
      lng: 127.04613,
    },
    openingHours: weekdayOpeningHours([{ open: "11:30", close: "13:30" }]),
    isActive: true,
  },
  {
    id: "c_byulridalli",
    name: "별리달리",
    description: "카이마루(푸드코트) 입점 매장.",
    location: { building: "N11", floor: "1F", lat: 36.37379, lng: 127.35925 },
    openingHours: kaimaruFoodCourtHours,
    isActive: true,
  },
  {
    id: "c_little_hanoi",
    name: "리틀하노이",
    description: "카이마루(푸드코트) 입점 매장.",
    location: { building: "N11", floor: "1F", lat: 36.37379, lng: 127.35925 },
    openingHours: kaimaruFoodCourtHours,
    isActive: true,
  },
  {
    id: "c_camto",
    name: "캠토",
    description: "카이마루(푸드코트) 입점 매장.",
    location: { building: "N11", floor: "1F", lat: 36.37379, lng: 127.35925 },
    openingHours: weekdayOpeningHours([{ open: "08:00", close: "19:00" }]),
    isActive: true,
  },
  {
    id: "c_wellchai",
    name: "웰차이",
    description: "카이마루(푸드코트) 입점 매장.",
    location: { building: "N11", floor: "1F", lat: 36.37379, lng: 127.35925 },
    openingHours: kaimaruFoodCourtHours,
    isActive: true,
  },
  {
    id: "c_juiceking",
    name: "쥬스킹",
    description: "카이마루(N11) 1층 음료 매장.",
    location: { building: "N11", floor: "1F", lat: 36.37379, lng: 127.35925 },
    openingHours: weekdayOpeningHours([{ open: "09:30", close: "20:00" }]),
    isActive: true,
  },
  {
    id: "c_pulbitmaru",
    name: "풀빛마루",
    description: "북측 학생회관(N12) 1층 할랄 메뉴 매장.",
    location: { building: "N12", floor: "1F", lat: 36.374, lng: 127.3597 },
    openingHours: {
      monday: [{ open: "08:20", close: "18:45" }],
      tuesday: [{ open: "08:20", close: "18:45" }],
      wednesday: [{ open: "08:20", close: "18:45" }],
      thursday: [{ open: "08:20", close: "18:45" }],
      friday: [{ open: "08:20", close: "18:45" }],
      saturday: [{ open: "11:20", close: "18:30" }],
    },
    isActive: true,
  },
  {
    id: "c_subway",
    name: "써브웨이",
    description: "정문술빌딩(E16)에 위치한 샌드위치 매장.",
    location: { building: "E16", floor: "1F", lat: 36.37154, lng: 127.36191 },
    openingHours: {
      monday: [{ open: "08:00", close: "23:00" }],
      tuesday: [{ open: "08:00", close: "23:00" }],
      wednesday: [{ open: "08:00", close: "23:00" }],
      thursday: [{ open: "08:00", close: "23:00" }],
      friday: [{ open: "08:00", close: "23:00" }],
      saturday: [{ open: "08:00", close: "23:00" }],
      sunday: [{ open: "08:00", close: "23:00" }],
    },
    isActive: true,
  },
  {
    id: "c_faculty_club",
    name: "패컬티 클럽",
    description: "교직원회관(E5) 2층 예약 중심 식당.",
    location: { building: "E5", floor: "2F", lat: 36.36926, lng: 127.3636 },
    openingHours: eastFacultyHours,
    isActive: true,
  },
  {
    id: "c_thekeun_dosirak",
    name: "더큰도시락",
    description: "서측 학생회관(W2) 2층 도시락 매장.",
    location: { building: "W2", floor: "2F", lat: 36.36734, lng: 127.36097 },
    openingHours: weekdayOpeningHours([{ open: "10:00", close: "19:00" }]),
    isActive: true,
  },
  {
    id: "c_taeul",
    name: "태울관 식당",
    description: "태울관(N13) 2층 식당가.",
    location: { building: "N13", floor: "2F", lat: 36.3732, lng: 127.36004 },
    openingHours: weekdayOpeningHours([{ open: "10:30", close: "20:00" }]),
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

export const mockFavorites: FavoriteMeal[] = [
  {
    id: "fav_chicken_curry",
    mealId: "m_chicken_curry",
    meal: pickFavoriteMeal("m_chicken_curry"),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
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
    cafeteria: { id: "c_kaimaru", name: "카이마루(북측 카페테리아)" },
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
    cafeteria: { id: "c_kaimaru", name: "카이마루(북측 카페테리아)" },
    meal: pickMealCard("m_chicken_curry"),
  },
  {
    id: "ms_west_salad_lunch",
    date: TODAY,
    mealTime: "LUNCH",
    price: 4500,
    status: "AVAILABLE",
    averageRating: 4.0,
    verifiedReviewCount: 5,
    cafeteria: { id: "c_west", name: "서맛골(서측식당)" },
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
    cafeteria: { id: "c_kaimaru", name: "카이마루(북측 카페테리아)" },
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

export const mockNotifications: Notification[] = [
  {
    id: "noti_manager_reply",
    type: "MANAGER_REPLY",
    title: "리뷰에 답변이 등록되었습니다.",
    message: "작성하신 리뷰에 식당 매니저 답변이 등록되었습니다.",
    resourceType: "REVIEW",
    resourceId: "rev_003",
    readAt: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: "noti_receipt_ready",
    type: "REVIEW_AVAILABLE",
    title: "리뷰를 작성할 수 있습니다.",
    message: "영수증이 확인되어 리뷰 작성이 가능해졌습니다.",
    resourceType: "RECEIPT",
    resourceId: "rcp_003",
    readAt: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: "noti_menu_sold_out",
    type: "MENU_STATUS_UPDATED",
    title: "Pasta Carbonara 상태가 변경되었습니다.",
    message: "Kaimaru의 Pasta Carbonara 메뉴가 품절 상태로 변경되었습니다.",
    resourceType: "MENU_SERVING",
    resourceId: "ms_kaimaru_pasta_dinner",
    readAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 70).toISOString(),
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

function pickFavoriteMeal(id: string): FavoriteMeal["meal"] {
  const meal = mockMeals.find((m) => m.id === id);
  if (!meal) {
    throw new Error(`mock meal ${id} not found`);
  }
  return {
    id: meal.id,
    name: meal.name,
    category: meal.category,
    imageUrl: meal.imageUrl,
    dietaryLabels: meal.dietaryLabels,
    allergens: meal.allergens,
  };
}

export const mockDiscounts: Discount[] = [
  {
    id: "d1",
    cafeteriaName: "West Cafeteria",
    menuName: "Bulgogi Rice Set",
    discountedPrice: 4500,
    menuServingId: "ms1",
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "d2",
    cafeteriaName: "East Cafeteria",
    menuName: "Kimchi Jjigae",
    discountedPrice: 3800,
    menuServingId: "ms2",
    validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];
