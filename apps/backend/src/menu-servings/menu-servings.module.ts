import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MenuServing, MenuServingSchema } from "./schemas/menu-serving.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: MenuServing.name, schema: MenuServingSchema }])],
  exports: [MongooseModule],
})
export class MenuServingsModule {}
