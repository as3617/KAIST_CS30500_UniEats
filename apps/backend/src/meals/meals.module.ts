import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import {
  CafeteriaManager,
  CafeteriaManagerSchema,
} from "../cafeteria-managers/schemas/cafeteria-manager.schema";
import {
  MenuServing,
  MenuServingSchema,
} from "../menu-servings/schemas/menu-serving.schema";
import { MealsController } from "./meals.controller";
import { MealsService } from "./meals.service";
import { Meal, MealSchema } from "./schemas/meal.schema";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Meal.name, schema: MealSchema },
      { name: CafeteriaManager.name, schema: CafeteriaManagerSchema },
      { name: MenuServing.name, schema: MenuServingSchema },
    ]),
  ],
  controllers: [MealsController],
  providers: [MealsService],
  exports: [MongooseModule],
})
export class MealsModule {}
