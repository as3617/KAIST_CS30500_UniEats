import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Meal, MealSchema } from "../meals/schemas/meal.schema";
import { FavoritesService } from "./favorites.service";
import { Favorite, FavoriteSchema } from "./schemas/favorite.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Favorite.name, schema: FavoriteSchema },
      { name: Meal.name, schema: MealSchema },
    ]),
  ],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
