import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MenuServing, MenuServingSchema } from "../menu-servings/schemas/menu-serving.schema";
import { ViewHistoriesService } from "./view-histories.service";
import { ViewHistory, ViewHistorySchema } from "./schemas/view-history.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ViewHistory.name, schema: ViewHistorySchema },
      { name: MenuServing.name, schema: MenuServingSchema },
    ]),
  ],
  providers: [ViewHistoriesService],
  exports: [ViewHistoriesService],
})
export class ViewHistoriesModule {}
