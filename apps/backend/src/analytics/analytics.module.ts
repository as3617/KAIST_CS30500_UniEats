import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MenuServing, MenuServingSchema } from "../menu-servings/schemas/menu-serving.schema";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: MenuServing.name, schema: MenuServingSchema }]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
