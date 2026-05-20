import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Cafeteria, CafeteriaSchema } from "./schemas/cafeteria.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: Cafeteria.name, schema: CafeteriaSchema }])],
  exports: [MongooseModule],
})
export class CafeteriasModule {}
