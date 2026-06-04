import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import {
  CafeteriaManager,
  CafeteriaManagerSchema,
} from "../cafeteria-managers/schemas/cafeteria-manager.schema";
import { Cafeteria, CafeteriaSchema } from "../cafeterias/schemas/cafeteria.schema";
import { Meal, MealSchema } from "../meals/schemas/meal.schema";
import {
  MenuServing,
  MenuServingSchema,
} from "../menu-servings/schemas/menu-serving.schema";
import { NotificationsModule } from "../notifications/notifications.module";
import { Receipt, ReceiptSchema } from "../receipts/schemas/receipt.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";
import { Review, ReviewSchema } from "./schemas/review.schema";

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: Receipt.name, schema: ReceiptSchema },
      { name: MenuServing.name, schema: MenuServingSchema },
      { name: CafeteriaManager.name, schema: CafeteriaManagerSchema },
      { name: User.name, schema: UserSchema },
      { name: Meal.name, schema: MealSchema },
      { name: Cafeteria.name, schema: CafeteriaSchema },
    ]),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService, MongooseModule],
})
export class ReviewsModule {}
