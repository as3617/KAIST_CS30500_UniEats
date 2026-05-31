import mongoose, { Model, Types } from "mongoose";
import { Cafeteria, CafeteriaSchema } from "../cafeterias/schemas/cafeteria.schema";
import { MenuServingStatus, MenuSource, UserRole } from "../common/enums";
import { Meal, MealSchema } from "../meals/schemas/meal.schema";
import {
  MenuServing,
  MenuServingSchema,
} from "../menu-servings/schemas/menu-serving.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { KAIST_CAFETERIA_SEEDS, KAIST_MENU_ITEM_SEEDS } from "./kaist-seed-data";

type DocumentWithId = { _id: Types.ObjectId };

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/unieats";
  await mongoose.connect(uri);

  const UserModel = mongoose.model(User.name, UserSchema) as Model<User>;
  const CafeteriaModel = mongoose.model(Cafeteria.name, CafeteriaSchema) as Model<Cafeteria>;
  const MealModel = mongoose.model(Meal.name, MealSchema) as Model<Meal>;
  const MenuServingModel = mongoose.model(
    MenuServing.name,
    MenuServingSchema,
  ) as Model<MenuServing>;

  const seedUser = await upsertOne(UserModel, { email: "seed-admin@kaist.ac.kr" }, {
    email: "seed-admin@kaist.ac.kr",
    passwordHash: "seed-only-not-for-login",
    nickname: "Seed Admin",
    role: UserRole.ADMIN,
    isEmailVerified: true,
  });

  const cafeteriaByKey = new Map<string, DocumentWithId>();
  for (const cafeteriaSeed of KAIST_CAFETERIA_SEEDS) {
    const cafeteria = await upsertOne(
      CafeteriaModel,
      { name: cafeteriaSeed.name },
      {
        name: cafeteriaSeed.name,
        description: cafeteriaSeed.description,
        location: cafeteriaSeed.location,
        openingHours: cafeteriaSeed.openingHours,
        isActive: true,
      },
    );
    cafeteriaByKey.set(cafeteriaSeed.key, cafeteria);
  }

  const today = todayInSeoul();
  let cafeteriaCount = cafeteriaByKey.size;
  let mealCount = 0;
  let menuServingCount = 0;
  let dailyMenuItemCount = 0;
  let fixedMenuItemCount = 0;

  for (const menuItemSeed of KAIST_MENU_ITEM_SEEDS) {
    const cafeteria = cafeteriaByKey.get(menuItemSeed.cafeteriaKey);
    if (!cafeteria) {
      throw new Error(`cafeteria seed ${menuItemSeed.cafeteriaKey} not found`);
    }

    const meal = await upsertOne(
      MealModel,
      { name: menuItemSeed.name },
      {
        name: menuItemSeed.name,
        description: menuItemSeed.description,
        category: menuItemSeed.category,
        ingredients: menuItemSeed.ingredients,
        allergens: menuItemSeed.allergens,
        dietaryLabels: menuItemSeed.dietaryLabels,
        nutrition: {},
        createdBy: seedUser._id,
      },
    );
    mealCount += 1;
    if (menuItemSeed.source === MenuSource.DAILY_MENU) {
      dailyMenuItemCount += 1;
      continue;
    } else {
      fixedMenuItemCount += 1;
    }

    // The app reads date-based MenuServing rows. Fixed-menu stores are
    // materialized for the seed date from their standing menu board.
    await MenuServingModel.findOneAndUpdate(
      {
        date: today,
        cafeteriaId: cafeteria._id,
        mealTime: menuItemSeed.mealTime,
        mealId: meal._id,
      },
      {
        $set: {
          date: today,
          cafeteriaId: cafeteria._id,
          mealId: meal._id,
          mealTime: menuItemSeed.mealTime,
          price: menuItemSeed.price,
          status: MenuServingStatus.AVAILABLE,
          source: MenuSource.FIXED_MENU,
          sourceExternalKey: `kaist-seed:${menuItemSeed.key}`,
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
    menuServingCount += 1;
  }

  console.log(
    JSON.stringify({
      seededDate: today,
      cafeterias: cafeteriaCount,
      meals: mealCount,
      dailyMenuItems: dailyMenuItemCount,
      fixedMenuItems: fixedMenuItemCount,
      menuServings: menuServingCount,
    }),
  );
}

async function upsertOne<T>(
  model: Model<T>,
  filter: Record<string, unknown>,
  document: Record<string, unknown>,
): Promise<DocumentWithId> {
  const result = await model
    .findOneAndUpdate(
      filter,
      {
        $set: document,
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
    throw new Error(`failed to upsert ${model.modelName}`);
  }

  return result as DocumentWithId;
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

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
