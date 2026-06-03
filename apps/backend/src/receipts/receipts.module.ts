import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Cafeteria, CafeteriaSchema } from "../cafeterias/schemas/cafeteria.schema";
import { Meal, MealSchema } from "../meals/schemas/meal.schema";
import {
  MenuServing,
  MenuServingSchema,
} from "../menu-servings/schemas/menu-serving.schema";
import { NotificationsModule } from "../notifications/notifications.module";
import { ReceiptsController } from "./receipts.controller";
import { ReceiptsService } from "./receipts.service";
import { Receipt, ReceiptSchema } from "./schemas/receipt.schema";
import { OCR_CLIENT } from "./ocr-clients/ocr-client.interface";
import { NaverClovaOcrClient } from "./ocr-clients/naver-clova-ocr.client";
import { TesseractOcrClient } from "./ocr-clients/tesseract-ocr.client";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Receipt.name, schema: ReceiptSchema },
      { name: MenuServing.name, schema: MenuServingSchema },
      { name: Meal.name, schema: MealSchema },
      { name: Cafeteria.name, schema: CafeteriaSchema },
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [ReceiptsController],
  providers: [
    ReceiptsService,
    TesseractOcrClient,
    NaverClovaOcrClient,
    {
      provide: OCR_CLIENT,
      useFactory: (
        tesseractClient: TesseractOcrClient,
        clovaClient: NaverClovaOcrClient,
      ) => {
        return process.env.OCR_PROVIDER === "clova" ? clovaClient : tesseractClient;
      },
      inject: [TesseractOcrClient, NaverClovaOcrClient],
    },
  ],
  exports: [ReceiptsService, MongooseModule],
})
export class ReceiptsModule {}
