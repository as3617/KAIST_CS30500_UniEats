import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Receipt, ReceiptSchema } from "./schemas/receipt.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: Receipt.name, schema: ReceiptSchema }])],
  exports: [MongooseModule],
})
export class ReceiptsModule {}
