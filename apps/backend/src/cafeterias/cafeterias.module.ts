import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CafeteriasController } from "./cafeterias.controller";
import { CafeteriasService } from "./cafeterias.service";
import { Cafeteria, CafeteriaSchema } from "./schemas/cafeteria.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: Cafeteria.name, schema: CafeteriaSchema }])],
  controllers: [CafeteriasController],
  providers: [CafeteriasService],
  exports: [MongooseModule],
})
export class CafeteriasModule {}
