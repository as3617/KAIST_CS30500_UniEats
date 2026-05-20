import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Meal, MealSchema } from "./schemas/meal.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: Meal.name, schema: MealSchema }])],
  exports: [MongooseModule],
})
export class MealsModule {}
