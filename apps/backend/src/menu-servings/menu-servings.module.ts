import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Cafeteria, CafeteriaSchema } from "../cafeterias/schemas/cafeteria.schema";
import { Meal, MealSchema } from "../meals/schemas/meal.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { MenuServingsController } from "./menu-servings.controller";
import { MenuServingsService } from "./menu-servings.service";
import { MenuServing, MenuServingSchema } from "./schemas/menu-serving.schema";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: MenuServing.name, schema: MenuServingSchema },
      { name: Meal.name, schema: MealSchema },
      { name: Cafeteria.name, schema: CafeteriaSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [MenuServingsController],
  providers: [MenuServingsService],
  exports: [MongooseModule],
})
export class MenuServingsModule {}
