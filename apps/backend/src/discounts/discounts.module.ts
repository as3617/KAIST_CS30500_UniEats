import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Discount, DiscountSchema } from "./schemas/discount.schema";
import { DiscountsController } from "./discounts.controller";
import { DiscountsService } from "./discounts.service";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: Discount.name, schema: DiscountSchema }]),
  ],
  controllers: [DiscountsController],
  providers: [DiscountsService],
})
export class DiscountsModule {}
