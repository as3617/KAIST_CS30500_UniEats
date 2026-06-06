import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import {
  CafeteriaManager,
  CafeteriaManagerSchema,
} from "../cafeteria-managers/schemas/cafeteria-manager.schema";
import { Cafeteria, CafeteriaSchema } from "../cafeterias/schemas/cafeteria.schema";
import { MenuServing, MenuServingSchema } from "../menu-servings/schemas/menu-serving.schema";
import { Discount, DiscountSchema } from "./schemas/discount.schema";
import { DiscountsController } from "./discounts.controller";
import { DiscountsService } from "./discounts.service";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Discount.name, schema: DiscountSchema },
      { name: Cafeteria.name, schema: CafeteriaSchema },
      { name: MenuServing.name, schema: MenuServingSchema },
      { name: CafeteriaManager.name, schema: CafeteriaManagerSchema },
    ]),
  ],
  controllers: [DiscountsController],
  providers: [DiscountsService],
})
export class DiscountsModule {}
