import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import {
  CafeteriaManager,
  CafeteriaManagerSchema,
} from "../cafeteria-managers/schemas/cafeteria-manager.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { CafeteriasController } from "./cafeterias.controller";
import { CafeteriasService } from "./cafeterias.service";
import { Cafeteria, CafeteriaSchema } from "./schemas/cafeteria.schema";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Cafeteria.name, schema: CafeteriaSchema },
      { name: CafeteriaManager.name, schema: CafeteriaManagerSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [CafeteriasController],
  providers: [CafeteriasService],
  exports: [MongooseModule],
})
export class CafeteriasModule {}
