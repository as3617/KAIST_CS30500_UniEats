import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  CafeteriaManager,
  CafeteriaManagerSchema,
} from "./schemas/cafeteria-manager.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CafeteriaManager.name, schema: CafeteriaManagerSchema }]),
  ],
  exports: [MongooseModule],
})
export class CafeteriaManagersModule {}
