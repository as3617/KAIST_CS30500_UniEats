import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import {
  CafeteriaManager,
  CafeteriaManagerSchema,
} from "../cafeteria-managers/schemas/cafeteria-manager.schema";
import { Cafeteria, CafeteriaSchema } from "../cafeterias/schemas/cafeteria.schema";
import { Favorite, FavoriteSchema } from "../favorites/schemas/favorite.schema";
import { Meal, MealSchema } from "../meals/schemas/meal.schema";
import { NotificationsModule } from "../notifications/notifications.module";
import { User, UserSchema } from "../users/schemas/user.schema";
import { ViewHistoriesModule } from "../view-histories/view-histories.module";
import { MenuServingEventsService } from "./menu-serving-events.service";
import { MenuServingsController } from "./menu-servings.controller";
import { MenuServingsService } from "./menu-servings.service";
import { MenuServing, MenuServingSchema } from "./schemas/menu-serving.schema";

@Module({
  imports: [
    AuthModule,
    ViewHistoriesModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: MenuServing.name, schema: MenuServingSchema },
      { name: Meal.name, schema: MealSchema },
      { name: Cafeteria.name, schema: CafeteriaSchema },
      { name: User.name, schema: UserSchema },
      { name: CafeteriaManager.name, schema: CafeteriaManagerSchema },
      { name: Favorite.name, schema: FavoriteSchema },
    ]),
  ],
  controllers: [MenuServingsController],
  providers: [MenuServingEventsService, MenuServingsService],
  exports: [MongooseModule],
})
export class MenuServingsModule {}
