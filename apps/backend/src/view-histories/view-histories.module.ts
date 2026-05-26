import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ViewHistory, ViewHistorySchema } from "./schemas/view-history.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: ViewHistory.name, schema: ViewHistorySchema }])],
  exports: [MongooseModule],
})
export class ViewHistoriesModule {}
