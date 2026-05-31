import { CategoryCode, DietaryLabelCode, MealTime, MenuSource } from "../common/enums";

type CafeteriaSeed = {
  key: string;
  name: string;
  description: string;
  location: {
    building: string;
    floor: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  openingHours: Record<string, Array<{ open: string; close: string }>>;
};

type MenuItemSeed = {
  key: string;
  cafeteriaKey: string;
  source: MenuSource;
  name: string;
  description: string;
  category: CategoryCode;
  price: number;
  mealTime: MealTime;
  ingredients: string[];
  allergens: string[];
  dietaryLabels: DietaryLabelCode[];
};

export type DailyMenuSourceSeed = {
  cafeteriaKey: string;
  dvsCd: string;
  menuNamePrefix: string;
};

const weekdayHours = (ranges: Array<{ open: string; close: string }>) => ({
  monday: ranges,
  tuesday: ranges,
  wednesday: ranges,
  thursday: ranges,
  friday: ranges,
});

const weekdayBreakfastLunchDinner = {
  monday: [
    { open: "08:00", close: "09:00" },
    { open: "11:20", close: "13:30" },
    { open: "17:20", close: "19:00" },
  ],
  tuesday: [
    { open: "08:00", close: "09:00" },
    { open: "11:20", close: "13:30" },
    { open: "17:20", close: "19:00" },
  ],
  wednesday: [
    { open: "08:00", close: "09:00" },
    { open: "11:20", close: "13:30" },
    { open: "17:20", close: "19:00" },
  ],
  thursday: [
    { open: "08:00", close: "09:00" },
    { open: "11:20", close: "13:30" },
    { open: "17:20", close: "19:00" },
  ],
  friday: [
    { open: "08:00", close: "09:00" },
    { open: "11:20", close: "13:30" },
    { open: "17:20", close: "19:00" },
  ],
};

const westBreakfastLunchDinner = weekdayHours([
  { open: "08:00", close: "09:30" },
  { open: "11:30", close: "13:30" },
  { open: "17:00", close: "19:00" },
]);

const eastStudentBreakfastLunchDinner = weekdayHours([
  { open: "08:00", close: "10:00" },
  { open: "11:30", close: "14:00" },
  { open: "17:30", close: "19:00" },
]);

const eastFacultyLunchDinner = weekdayHours([
  { open: "11:30", close: "13:30" },
  { open: "17:30", close: "19:00" },
]);

const facultyHallLunchDinner = weekdayHours([
  { open: "11:20", close: "13:30" },
  { open: "17:30", close: "18:30" },
]);

const munjiBreakfastLunchDinner = weekdayHours([
  { open: "07:30", close: "09:00" },
  { open: "11:00", close: "13:00" },
  { open: "17:00", close: "18:40" },
]);

const hwaamBreakfastLunchDinner = weekdayHours([
  { open: "07:30", close: "09:00" },
  { open: "11:30", close: "13:00" },
  { open: "17:30", close: "18:40" },
]);

const kaimaruFoodCourtHours = {
  monday: [{ open: "10:30", close: "20:00" }],
  tuesday: [{ open: "10:30", close: "20:00" }],
  wednesday: [{ open: "10:30", close: "20:00" }],
  thursday: [{ open: "10:30", close: "20:00" }],
  friday: [{ open: "10:30", close: "20:00" }],
};

export const KAIST_CAFETERIA_SEEDS: CafeteriaSeed[] = [
  {
    key: "kaimaru-north-cafeteria",
    name: "카이마루(북측 카페테리아)",
    description: "KAIST 학생식당(N11) 1층 북측 카페테리아.",
    location: { building: "N11", floor: "1F", lat: 36.3736, lng: 127.3608 },
    openingHours: weekdayBreakfastLunchDinner,
  },
  {
    key: "west-cafeteria",
    name: "서맛골(서측식당)",
    description: "KAIST 공식 식단 페이지에서 일별 식단을 제공하는 서측식당.",
    location: { building: "서측식당", floor: "1F" },
    openingHours: westBreakfastLunchDinner,
  },
  {
    key: "east-student-cafeteria",
    name: "동맛골(동측 학생식당)",
    description: "KAIST 공식 식단 페이지에서 일별 식단을 제공하는 동측 학생식당.",
    location: { building: "동측 학생식당", floor: "1F" },
    openingHours: eastStudentBreakfastLunchDinner,
  },
  {
    key: "east-faculty-cafeteria",
    name: "동맛골(동측 교직원식당)",
    description: "KAIST 공식 식단 페이지에서 일별 식단을 제공하는 동측 교직원식당.",
    location: { building: "동측 교직원식당", floor: "1F" },
    openingHours: eastFacultyLunchDinner,
  },
  {
    key: "faculty-hall-cafeteria",
    name: "교수회관",
    description: "KAIST 공식 식단 페이지에서 일별 식단을 제공하는 교수회관 식당.",
    location: { building: "교수회관", floor: "1F" },
    openingHours: facultyHallLunchDinner,
  },
  {
    key: "munji-cafeteria",
    name: "문지캠퍼스 구내식당",
    description: "KAIST 공식 식단 페이지에서 일별 식단을 제공하는 문지캠퍼스 구내식당.",
    location: { building: "문지캠퍼스", floor: "1F" },
    openingHours: munjiBreakfastLunchDinner,
  },
  {
    key: "hwaam-cafeteria",
    name: "화암 기숙사 식당",
    description: "KAIST 공식 식단 페이지에서 일별 식단을 제공하는 화암 기숙사 식당.",
    location: { building: "화암 기숙사", floor: "1F" },
    openingHours: hwaamBreakfastLunchDinner,
  },
  {
    key: "seoul-campus-cafeteria",
    name: "서울캠퍼스 구내식당",
    description: "KAIST 공식 식단 페이지에서 일별 식단을 제공하는 서울캠퍼스 구내식당.",
    location: { building: "서울캠퍼스", floor: "1F" },
    openingHours: weekdayHours([{ open: "11:30", close: "13:30" }]),
  },
  {
    key: "kaimaru-byulridalli",
    name: "별리달리",
    description: "카이마루(푸드코트) 입점 매장.",
    location: { building: "N11", floor: "1F", lat: 36.3736, lng: 127.3608 },
    openingHours: kaimaruFoodCourtHours,
  },
  {
    key: "kaimaru-thekeun-siktak",
    name: "더큰식탁",
    description: "카이마루(푸드코트) 입점 매장.",
    location: { building: "N11", floor: "1F", lat: 36.3736, lng: 127.3608 },
    openingHours: kaimaruFoodCourtHours,
  },
  {
    key: "kaimaru-little-hanoi",
    name: "리틀하노이",
    description: "카이마루(푸드코트) 입점 매장.",
    location: { building: "N11", floor: "1F", lat: 36.3736, lng: 127.3608 },
    openingHours: kaimaruFoodCourtHours,
  },
  {
    key: "kaimaru-camto",
    name: "캠토",
    description: "카이마루(푸드코트) 입점 매장.",
    location: { building: "N11", floor: "1F", lat: 36.3736, lng: 127.3608 },
    openingHours: kaimaruFoodCourtHours,
  },
  {
    key: "kaimaru-wellchai",
    name: "웰차이",
    description: "카이마루(푸드코트) 입점 매장.",
    location: { building: "N11", floor: "1F", lat: 36.3736, lng: 127.3608 },
    openingHours: kaimaruFoodCourtHours,
  },
  {
    key: "kaimaru-onigiri-gyudong",
    name: "오니기리와 이규동",
    description: "카이마루(푸드코트) 입점 매장.",
    location: { building: "N11", floor: "1F", lat: 36.3736, lng: 127.3608 },
    openingHours: kaimaruFoodCourtHours,
  },
  {
    key: "kaimaru-rolling-pasta",
    name: "롤링파스타",
    description: "카이마루(푸드코트) 입점 매장.",
    location: { building: "N11", floor: "1F", lat: 36.3736, lng: 127.3608 },
    openingHours: kaimaruFoodCourtHours,
  },
  {
    key: "kaimaru-bearstaco",
    name: "베어스타코",
    description: "카이마루(푸드코트) 입점 매장.",
    location: { building: "N11", floor: "1F", lat: 36.3736, lng: 127.3608 },
    openingHours: kaimaruFoodCourtHours,
  },
  {
    key: "pulbitmaru",
    name: "풀빛마루",
    description: "북측 학생회관(N12) 1층, 할랄 메뉴를 제공하는 매장.",
    location: { building: "N12", floor: "1F", lat: 36.3742, lng: 127.3611 },
    openingHours: {
      monday: [{ open: "08:20", close: "18:45" }],
      tuesday: [{ open: "08:20", close: "18:45" }],
      wednesday: [{ open: "08:20", close: "18:45" }],
      thursday: [{ open: "08:20", close: "18:45" }],
      friday: [{ open: "08:20", close: "18:45" }],
      saturday: [{ open: "11:20", close: "18:30" }],
    },
  },
  {
    key: "subway",
    name: "써브웨이",
    description: "정문술빌딩(E16)에 위치한 샌드위치 매장.",
    location: { building: "E16", floor: "1F", lat: 36.3723, lng: 127.3632 },
    openingHours: {
      monday: [{ open: "08:00", close: "23:00" }],
      tuesday: [{ open: "08:00", close: "23:00" }],
      wednesday: [{ open: "08:00", close: "23:00" }],
      thursday: [{ open: "08:00", close: "23:00" }],
      friday: [{ open: "08:00", close: "23:00" }],
      saturday: [{ open: "08:00", close: "23:00" }],
      sunday: [{ open: "08:00", close: "23:00" }],
    },
  },
];

export const KAIST_DAILY_MENU_SOURCE_SEEDS: DailyMenuSourceSeed[] = [
  {
    cafeteriaKey: "kaimaru-north-cafeteria",
    dvsCd: "fclt",
    menuNamePrefix: "카이마루",
  },
  {
    cafeteriaKey: "west-cafeteria",
    dvsCd: "west",
    menuNamePrefix: "서맛골",
  },
  {
    cafeteriaKey: "east-student-cafeteria",
    dvsCd: "east1",
    menuNamePrefix: "동맛골 학생식당",
  },
  {
    cafeteriaKey: "east-faculty-cafeteria",
    dvsCd: "east2",
    menuNamePrefix: "동맛골 교직원식당",
  },
  {
    cafeteriaKey: "faculty-hall-cafeteria",
    dvsCd: "emp",
    menuNamePrefix: "교수회관",
  },
  {
    cafeteriaKey: "munji-cafeteria",
    dvsCd: "icc",
    menuNamePrefix: "문지캠퍼스",
  },
  {
    cafeteriaKey: "hwaam-cafeteria",
    dvsCd: "hawam",
    menuNamePrefix: "화암 기숙사",
  },
  {
    cafeteriaKey: "seoul-campus-cafeteria",
    dvsCd: "seoul",
    menuNamePrefix: "서울캠퍼스",
  },
];

export const KAIST_MENU_ITEM_SEEDS: MenuItemSeed[] = [
  {
    key: "north-korean-set",
    cafeteriaKey: "kaimaru-north-cafeteria",
    source: MenuSource.DAILY_MENU,
    name: "오늘의 한식 백반",
    description: "카이마루 북측 카페테리아의 일별 학식 메뉴 예시.",
    category: CategoryCode.KOREAN,
    price: 6000,
    mealTime: MealTime.LUNCH,
    ingredients: ["rice", "soup", "kimchi", "seasonal side dishes"],
    allergens: ["SOYBEAN"],
    dietaryLabels: [],
  },
  {
    key: "byulridalli-bibimbap",
    cafeteriaKey: "kaimaru-byulridalli",
    source: MenuSource.FIXED_MENU,
    name: "별리달리 비빔밥",
    description: "카이마루 푸드코트 별리달리의 고정 메뉴판 항목.",
    category: CategoryCode.KOREAN,
    price: 7500,
    mealTime: MealTime.LUNCH,
    ingredients: ["rice", "vegetables", "egg", "gochujang"],
    allergens: ["EGG", "SOYBEAN"],
    dietaryLabels: [DietaryLabelCode.NO_BEEF, DietaryLabelCode.NO_PORK],
  },
  {
    key: "little-hanoi-pho",
    cafeteriaKey: "kaimaru-little-hanoi",
    source: MenuSource.FIXED_MENU,
    name: "리틀하노이 쌀국수",
    description: "카이마루 푸드코트 리틀하노이의 고정 메뉴판 항목.",
    category: CategoryCode.ASIAN,
    price: 8500,
    mealTime: MealTime.LUNCH,
    ingredients: ["rice noodles", "beef broth", "herbs"],
    allergens: ["BEEF"],
    dietaryLabels: [DietaryLabelCode.NO_PORK],
  },
  {
    key: "wellchai-jajangmyeon",
    cafeteriaKey: "kaimaru-wellchai",
    source: MenuSource.FIXED_MENU,
    name: "웰차이 짜장면",
    description: "카이마루 푸드코트 웰차이의 고정 메뉴판 항목.",
    category: CategoryCode.CHINESE,
    price: 7000,
    mealTime: MealTime.LUNCH,
    ingredients: ["wheat noodles", "black bean sauce", "onion"],
    allergens: ["WHEAT", "SOYBEAN"],
    dietaryLabels: [DietaryLabelCode.NO_BEEF],
  },
  {
    key: "onigiri-gyudong",
    cafeteriaKey: "kaimaru-onigiri-gyudong",
    source: MenuSource.FIXED_MENU,
    name: "규동",
    description: "오니기리와 이규동의 고정 메뉴판 항목.",
    category: CategoryCode.JAPANESE,
    price: 7800,
    mealTime: MealTime.LUNCH,
    ingredients: ["rice", "beef", "onion", "soy sauce"],
    allergens: ["BEEF", "SOYBEAN", "WHEAT"],
    dietaryLabels: [DietaryLabelCode.NO_PORK],
  },
  {
    key: "rolling-pasta-tomato",
    cafeteriaKey: "kaimaru-rolling-pasta",
    source: MenuSource.FIXED_MENU,
    name: "토마토 파스타",
    description: "롤링파스타의 고정 메뉴판 항목.",
    category: CategoryCode.WESTERN,
    price: 7900,
    mealTime: MealTime.LUNCH,
    ingredients: ["pasta", "tomato sauce", "garlic"],
    allergens: ["WHEAT", "TOMATO"],
    dietaryLabels: [DietaryLabelCode.NO_BEEF, DietaryLabelCode.NO_PORK],
  },
  {
    key: "bearstaco-taco",
    cafeteriaKey: "kaimaru-bearstaco",
    source: MenuSource.FIXED_MENU,
    name: "타코 세트",
    description: "베어스타코의 고정 메뉴판 항목.",
    category: CategoryCode.WESTERN,
    price: 8900,
    mealTime: MealTime.LUNCH,
    ingredients: ["tortilla", "beef", "tomato", "lettuce"],
    allergens: ["BEEF", "WHEAT", "TOMATO"],
    dietaryLabels: [DietaryLabelCode.NO_PORK],
  },
  {
    key: "pulbitmaru-halal-burrito",
    cafeteriaKey: "pulbitmaru",
    source: MenuSource.FIXED_MENU,
    name: "할랄 브리또",
    description: "풀빛마루의 고정 메뉴판 항목.",
    category: CategoryCode.ASIAN,
    price: 6500,
    mealTime: MealTime.LUNCH,
    ingredients: ["tortilla", "chicken", "rice", "vegetables"],
    allergens: ["CHICKEN", "WHEAT"],
    dietaryLabels: [DietaryLabelCode.HALAL, DietaryLabelCode.NO_BEEF, DietaryLabelCode.NO_PORK],
  },
  {
    key: "subway-sandwich",
    cafeteriaKey: "subway",
    source: MenuSource.FIXED_MENU,
    name: "써브웨이 샌드위치 세트",
    description: "써브웨이의 고정 메뉴판 항목.",
    category: CategoryCode.WESTERN,
    price: 9200,
    mealTime: MealTime.ALL_DAY,
    ingredients: ["bread", "lettuce", "tomato", "ham", "cheese"],
    allergens: ["WHEAT", "MILK", "PORK", "TOMATO"],
    dietaryLabels: [],
  },
];
