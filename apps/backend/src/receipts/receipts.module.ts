import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Cafeteria, CafeteriaSchema } from "../cafeterias/schemas/cafeteria.schema";
import { Meal, MealSchema } from "../meals/schemas/meal.schema";
import {
  MenuServing,
  MenuServingSchema,
} from "../menu-servings/schemas/menu-serving.schema";
import { ReceiptsController } from "./receipts.controller";
import { ReceiptsService } from "./receipts.service";
import { Receipt, ReceiptSchema } from "./schemas/receipt.schema";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Receipt.name, schema: ReceiptSchema },
      { name: MenuServing.name, schema: MenuServingSchema },
      { name: Meal.name, schema: MealSchema },
      { name: Cafeteria.name, schema: CafeteriaSchema },
    ]),
  ],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
  exports: [ReceiptsService, MongooseModule],
})
export class ReceiptsModule {}
