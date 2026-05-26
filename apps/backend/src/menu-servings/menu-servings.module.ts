import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Cafeteria, CafeteriaSchema } from "../cafeterias/schemas/cafeteria.schema";
import { Meal, MealSchema } from "../meals/schemas/meal.schema";
import { MenuServingsController } from "./menu-servings.controller";
import { MenuServingsService } from "./menu-servings.service";
import { MenuServing, MenuServingSchema } from "./schemas/menu-serving.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MenuServing.name, schema: MenuServingSchema },
      { name: Meal.name, schema: MealSchema },
      { name: Cafeteria.name, schema: CafeteriaSchema },
    ]),
  ],
  controllers: [MenuServingsController],
  providers: [MenuServingsService],
  exports: [MongooseModule],
})
export class MenuServingsModule {}
