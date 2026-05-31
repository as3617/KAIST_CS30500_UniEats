import mongoose, { Model, Types } from "mongoose";
import { Cafeteria, CafeteriaSchema } from "../cafeterias/schemas/cafeteria.schema";
import {
  AllergyCode,
  CategoryCode,
  MealTime,
  MenuServingStatus,
  MenuSource,
  UserRole,
} from "../common/enums";
import { Meal, MealSchema } from "../meals/schemas/meal.schema";
import {
  MenuServing,
  MenuServingSchema,
} from "../menu-servings/schemas/menu-serving.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import {
  DailyMenuSourceSeed,
  KAIST_CAFETERIA_SEEDS,
  KAIST_DAILY_MENU_SOURCE_SEEDS,
} from "./kaist-seed-data";

const KAIST_MENU_BASE_URL = "https://www.kaist.ac.kr/kr/html/campus/053001.html";
const KAIST_SEED_ADMIN_EMAIL = "seed-admin@kaist.ac.kr";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ALLERGY_BY_NUMBER: Record<string, AllergyCode> = {
  "1": AllergyCode.EGG,
  "2": AllergyCode.MILK,
  "3": AllergyCode.BUCKWHEAT,
  "4": AllergyCode.PEANUT,
  "5": AllergyCode.SOYBEAN,
  "6": AllergyCode.WHEAT,
  "7": AllergyCode.MACKEREL,
  "8": AllergyCode.CRAB,
  "9": AllergyCode.SHRIMP,
  "10": AllergyCode.PORK,
  "11": AllergyCode.PEACH,
  "12": AllergyCode.TOMATO,
  "13": AllergyCode.SULFITES,
  "14": AllergyCode.WALNUT,
  "15": AllergyCode.CHICKEN,
  "16": AllergyCode.BEEF,
  "17": AllergyCode.SQUID,
  "18": AllergyCode.SHELLFISH,
  "19": AllergyCode.PINE_NUT,
};

type DocumentWithId = { _id: Types.ObjectId };

type ParsedMenuItem = {
  date: string;
  mealTime: MealTime;
  sectionLabel: string;
  name: string;
  description: string;
  category: CategoryCode;
  price: number;
  ingredients: string[];
  allergens: AllergyCode[];
  sourceUrl: string;
  sourceExternalKey: string;
};

type SyncOptions = {
  startDate: string;
  days: number;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/unieats";
  await mongoose.connect(uri);

  const UserModel = mongoose.model(User.name, UserSchema) as Model<User>;
  const CafeteriaModel = mongoose.model(Cafeteria.name, CafeteriaSchema) as Model<Cafeteria>;
  const MealModel = mongoose.model(Meal.name, MealSchema) as Model<Meal>;
  const MenuServingModel = mongoose.model(
    MenuServing.name,
    MenuServingSchema,
  ) as Model<MenuServing>;

  const seedUser = await ensureSeedUser(UserModel);
  const cafeteriaByKey = await ensureDailyCafeterias(CafeteriaModel);

  let fetchedItems = 0;
  let upsertedServings = 0;
  let hiddenStaleServings = 0;
  const syncedDates = new Set<string>();
  const syncedSources = new Set<string>();

  for (const date of datesFrom(options.startDate, options.days)) {
    for (const source of KAIST_DAILY_MENU_SOURCE_SEEDS) {
      const cafeteria = cafeteriaByKey.get(source.cafeteriaKey);
      if (!cafeteria) {
        throw new Error(`daily cafeteria seed is missing: ${source.cafeteriaKey}`);
      }

      const sourceUrl = buildDailyMenuUrl(source.dvsCd, date);
      const html = await fetchHtml(sourceUrl);
      const items = parseKaistDailyMenuPage(html, date, sourceUrl, source);
      fetchedItems += items.length;

      if (items.length === 0) {
        continue;
      }

      syncedDates.add(date);
      syncedSources.add(source.dvsCd);
      const activeExternalKeys: string[] = [];
      for (const item of items) {
        const meal = await upsertMeal(MealModel, item, seedUser._id);
        await MenuServingModel.findOneAndUpdate(
          {
            source: MenuSource.DAILY_MENU,
            sourceExternalKey: item.sourceExternalKey,
          },
          {
            $set: {
              date: item.date,
              cafeteriaId: cafeteria._id,
              mealId: meal._id,
              mealTime: item.mealTime,
              price: item.price,
              status: MenuServingStatus.AVAILABLE,
              source: MenuSource.DAILY_MENU,
              sourceExternalKey: item.sourceExternalKey,
              sourceUrl: item.sourceUrl,
              lastSyncedAt: new Date(),
              createdBy: seedUser._id,
            },
            $setOnInsert: {
              averageRating: 0,
              verifiedReviewCount: 0,
            },
          },
          { upsert: true, returnDocument: "after", runValidators: true },
        )
          .lean()
          .exec();
        activeExternalKeys.push(item.sourceExternalKey);
        upsertedServings += 1;
      }

      const staleResult = await MenuServingModel.updateMany(
        {
          date,
          cafeteriaId: cafeteria._id,
          source: MenuSource.DAILY_MENU,
          sourceExternalKey: { $nin: activeExternalKeys },
        },
        {
          $set: {
            status: MenuServingStatus.HIDDEN,
            lastSyncedAt: new Date(),
          },
        },
      ).exec();
      hiddenStaleServings += staleResult.modifiedCount;
    }
  }

  console.log(
    JSON.stringify({
      source: "KAIST_OFFICIAL_MENU",
      startDate: options.startDate,
      days: options.days,
      syncedDates: [...syncedDates],
      syncedSources: [...syncedSources],
      fetchedItems,
      upsertedServings,
      hiddenStaleServings,
    }),
  );
}

export function parseKaistDailyMenuPage(
  html: string,
  date: string,
  sourceUrl: string,
  source: DailyMenuSourceSeed,
): ParsedMenuItem[] {
  const tableHtml = html.match(/<table[^>]*class=["'][^"']*table[^"']*["'][^>]*>[\s\S]*?<\/table>/i)?.[0];
  if (!tableHtml) {
    return [];
  }

  const headers = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((match) =>
    normalizeText(stripTags(match[1])),
  );
  const cells = [...tableHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) =>
    htmlCellToLines(match[1]),
  );

  return cells.flatMap((lines, cellIndex) => {
    const mealTime = mealTimeFromHeader(headers[cellIndex] ?? "");
    return splitMenuSections(lines, mealTimeLabel(mealTime)).map((section, sectionIndex) => {
      const cleanedItems = cleanMenuItems(section.items);
      const name = buildMealName(source.menuNamePrefix, date, mealTime, section.label, cleanedItems);
      const ingredients = extractIngredients(cleanedItems);
      const allergens = extractAllergens(cleanedItems);

      return {
        date,
        mealTime,
        sectionLabel: section.label,
        name,
        description: cleanedItems.join(" / "),
        category: inferCategory(cleanedItems),
        price: section.price,
        ingredients,
        allergens,
        sourceUrl,
        sourceExternalKey: [
          "kaist",
          source.dvsCd,
          date,
          mealTime.toLowerCase(),
          slugify(section.label),
          String(sectionIndex + 1),
        ].join(":"),
      };
    });
  });
}

function parseArgs(args: string[]): SyncOptions {
  const startArg = args.find((arg) => arg.startsWith("--start="))?.slice("--start=".length);
  const daysArg = args.find((arg) => arg.startsWith("--days="))?.slice("--days=".length);
  const startDate = startArg || defaultSyncStartDateInSeoul();
  const days = daysArg ? Number(daysArg) : 7;

  if (!DATE_PATTERN.test(startDate)) {
    throw new Error("--start must use YYYY-MM-DD format");
  }
  if (!Number.isInteger(days) || days < 1 || days > 14) {
    throw new Error("--days must be an integer between 1 and 14");
  }

  return { startDate, days };
}

async function ensureSeedUser(model: Model<User>) {
  const result = await model
    .findOneAndUpdate(
      { email: KAIST_SEED_ADMIN_EMAIL },
      {
        $set: {
          email: KAIST_SEED_ADMIN_EMAIL,
          passwordHash: "seed-only-not-for-login",
          nickname: "Seed Admin",
          role: UserRole.ADMIN,
          isEmailVerified: true,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    )
    .lean()
    .exec();

  if (!result?._id) {
    throw new Error("failed to upsert seed admin");
  }

  return result as DocumentWithId;
}

async function ensureDailyCafeterias(model: Model<Cafeteria>) {
  const cafeteriaByKey = new Map<string, DocumentWithId>();

  for (const source of KAIST_DAILY_MENU_SOURCE_SEEDS) {
    cafeteriaByKey.set(source.cafeteriaKey, await ensureCafeteriaByKey(model, source.cafeteriaKey));
  }

  return cafeteriaByKey;
}

async function ensureCafeteriaByKey(model: Model<Cafeteria>, cafeteriaKey: string) {
  const seed = KAIST_CAFETERIA_SEEDS.find((item) => item.key === cafeteriaKey);
  if (!seed) {
    throw new Error(`cafeteria seed is missing: ${cafeteriaKey}`);
  }

  const result = await model
    .findOneAndUpdate(
      { name: seed.name },
      {
        $set: {
          name: seed.name,
          description: seed.description,
          location: seed.location,
          openingHours: seed.openingHours,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    )
    .lean()
    .exec();

  if (!result?._id) {
    throw new Error(`failed to upsert cafeteria ${seed.name}`);
  }

  return result as DocumentWithId;
}

async function upsertMeal(
  model: Model<Meal>,
  item: ParsedMenuItem,
  createdBy: Types.ObjectId,
) {
  const result = await model
    .findOneAndUpdate(
      { name: item.name },
      {
        $set: {
          name: item.name,
          description: item.description,
          category: item.category,
          ingredients: item.ingredients,
          allergens: item.allergens,
          dietaryLabels: [],
          nutrition: {},
          createdBy,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    )
    .lean()
    .exec();

  if (!result?._id) {
    throw new Error(`failed to upsert meal ${item.name}`);
  }

  return result as DocumentWithId;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "UniEats KAIST menu sync",
    },
  });

  if (!response.ok) {
    throw new Error(`failed to fetch KAIST menu page: ${response.status}`);
  }

  return response.text();
}

function buildDailyMenuUrl(dvsCd: string, date: string) {
  return `${KAIST_MENU_BASE_URL}?dvs_cd=${encodeURIComponent(dvsCd)}&stt_dt=${encodeURIComponent(date)}`;
}

function splitMenuSections(lines: string[], fallbackLabel: string) {
  const sections: Array<{ label: string; price: number; items: string[] }> = [];
  let current: { label: string; price: number; items: string[] } | null = null;

  for (const line of lines) {
    if (isIgnorableMenuLine(line)) {
      continue;
    }

    const heading = parseSectionHeading(line);
    if (heading) {
      if (current && current.items.length > 0) {
        sections.push(current);
      }
      current = { ...heading, items: [] };
      continue;
    }

    const price = parsePriceOnly(line);
    if (price !== null) {
      current = current ?? { label: fallbackLabel, price: 0, items: [] };
      if (current.price === 0) {
        current.price = price;
      }
      continue;
    }

    current = current ?? { label: fallbackLabel, price: 0, items: [] };
    current.items.push(line);
  }

  if (current && current.items.length > 0) {
    sections.push(current);
  }

  return sections.map((section) => ({
    ...section,
    price: section.price || inferPrice(section.items),
    items: section.items.filter((item) => parsePriceOnly(item) === null),
  }));
}

function parseSectionHeading(line: string) {
  const match = line.match(
    /^((?:\d층\s*)?(?:(?:조식|중식|석식)\d*|천원의 아침밥|자율배식|[A-Z]코너|\d코너|일품|특식))(?:[^()[\]]*[\(\[]([\d,]+)원[\)\]])?/,
  );
  if (!match) {
    return null;
  }

  return {
    label: normalizeText(match[1]),
    price: match[2] ? Number(match[2].replace(/,/g, "")) : 0,
  };
}

function parsePriceOnly(line: string) {
  const match = line.match(/^[\(\[]?\s*([\d,]+)원\s*[\)\]]?$/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function inferPrice(items: string[]) {
  for (const item of items) {
    const match = item.match(/([\d,]+)원/);
    if (match) {
      return Number(match[1].replace(/,/g, ""));
    }
  }
  return 0;
}

function htmlCellToLines(html: string) {
  return decodeHtml(
    stripTags(
      html
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/\r/g, ""),
    ),
  )
    .split("\n")
    .map(normalizeText)
    .filter(Boolean);
}

function cleanMenuItems(items: string[]) {
  return items
    .map((item) => item.replace(/\/\*.*$/, ""))
    .map(normalizeText)
    .filter(Boolean)
    .filter((item) => !isIgnorableMenuLine(item))
    .filter((item) => parsePriceOnly(item) === null)
    .filter((item) => !item.startsWith("*"))
    .filter((item) => !/^\(\d+kcal\)$/i.test(item));
}

function extractIngredients(items: string[]) {
  return items
    .map(stripAllergyMarkers)
    .map((item) => item.replace(/\([^)]*\)/g, ""))
    .map((item) => item.replace(/[\[\(]?[\d,]+원[\]\)]?/g, ""))
    .map((item) => item.replace(/[*&]/g, " "))
    .flatMap((item) => item.split(/[\/,]/))
    .map(normalizeText)
    .filter((item) => item.length > 0)
    .slice(0, 20);
}

function extractAllergens(items: string[]) {
  const found = new Set<AllergyCode>();
  for (const item of items) {
    const groups = [
      ...item.matchAll(/\(([\d,\s.]+)\)/g),
      ...item.matchAll(/(?:^|[\s/])((?:\d{1,2})(?:[,.]\s*\d{1,2})+)(?=$|[\s/*])/g),
    ];
    for (const group of groups) {
      for (const number of group[1].split(/[,.]/).map((value) => value.trim())) {
        const allergy = ALLERGY_BY_NUMBER[number];
        if (allergy) {
          found.add(allergy);
        }
      }
    }
  }
  return [...found];
}

function buildMealName(
  prefix: string,
  date: string,
  mealTime: MealTime,
  sectionLabel: string,
  items: string[],
) {
  const coreItems = items
    .map(stripAllergyMarkers)
    .map((item) => item.replace(/\([^)]*\)/g, ""))
    .map((item) => item.replace(/[\[\(]?[\d,]+원[\]\)]?/g, ""))
    .map(normalizeText)
    .filter((item) => !isSideDish(item))
    .slice(0, 2);
  const suffix = coreItems.length > 0 ? ` - ${coreItems.join(", ")}` : "";
  const timeLabel = mealTimeLabel(mealTime);
  const section = sectionLabel === timeLabel ? timeLabel : `${timeLabel} ${sectionLabel}`;
  return `${prefix} ${section} ${date}${suffix}`;
}

function inferCategory(items: string[]) {
  const text = items.join(" ");
  if (/파스타|스프|돈까스|함박|모닝빵|피자|샐러드|브리또|타코/i.test(text)) {
    return CategoryCode.WESTERN;
  }
  if (/짜장|짬뽕|탕수육|볶음밥/i.test(text)) {
    return CategoryCode.CHINESE;
  }
  if (/우동|돈부리|오니기리|규동/i.test(text)) {
    return CategoryCode.JAPANESE;
  }
  if (/쌀국수|분짜|나시고랭|팟타이/i.test(text)) {
    return CategoryCode.ASIAN;
  }
  return CategoryCode.KOREAN;
}

function isSideDish(item: string) {
  return /쌀밥|흑미밥|맛김치|백김치|김치|야채샐러드|드레싱|도시락김|숭늉|하루과일|주시쿨|수제피클|음료/i.test(
    item,
  );
}

function isIgnorableMenuLine(item: string) {
  return (
    item === "-" ||
    item === "-->" ||
    item.startsWith("- ") ||
    item.startsWith("★") ||
    item.startsWith("※") ||
    /칼로리|원산지|알레르기|상기 메뉴는|운영시간|문의|캠페인|후원|지원금|학생증|소지 부탁/i.test(item)
  );
}

function stripAllergyMarkers(item: string) {
  return item.replace(/(?:^|[\s/])(?:\d{1,2})(?:[,.]\s*\d{1,2})+(?=$|[\s/*])/g, " ");
}

function mealTimeFromHeader(header: string) {
  if (header.includes("조식")) {
    return MealTime.BREAKFAST;
  }
  if (header.includes("석식")) {
    return MealTime.DINNER;
  }
  return MealTime.LUNCH;
}

function mealTimeLabel(mealTime: MealTime) {
  if (mealTime === MealTime.BREAKFAST) {
    return "조식";
  }
  if (mealTime === MealTime.DINNER) {
    return "석식";
  }
  if (mealTime === MealTime.ALL_DAY) {
    return "상시";
  }
  return "중식";
}

function stripTags(html: string) {
  return html.replace(/<[^>]*>/g, " ");
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function datesFrom(startDate: string, days: number) {
  return Array.from({ length: days }, (_, index) => addDays(startDate, index));
}

function defaultSyncStartDateInSeoul() {
  const today = todayInSeoul();
  const weekday = dayOfWeek(today);
  const offsetToMonday = weekday === 0 ? 1 : 1 - weekday;
  return addDays(today, offsetToMonday);
}

function todayInSeoul() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dayOfWeek(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
