import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { MenuServing, MenuServingSchema } from "../menu-servings/schemas/menu-serving.schema";
import { ReceiptsController } from "./receipts.controller";
import { ReceiptsService } from "./receipts.service";
import { Receipt, ReceiptSchema } from "./schemas/receipt.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Receipt.name, schema: ReceiptSchema },
      { name: MenuServing.name, schema: MenuServingSchema },
    ]),
    AuthModule,
  ],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
  exports: [ReceiptsService, MongooseModule],
})
export class ReceiptsModule {}
