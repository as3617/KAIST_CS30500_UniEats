import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Cafeteria, CafeteriaSchema } from "../cafeterias/schemas/cafeteria.schema";
import { CafeteriaManager, CafeteriaManagerSchema } from "../cafeteria-managers/schemas/cafeteria-manager.schema";
import { FavoritesModule } from "../favorites/favorites.module";
import { ViewHistoriesModule } from "../view-histories/view-histories.module";
import { User, UserSchema } from "./schemas/user.schema";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [
    AuthModule,
    FavoritesModule,
    ViewHistoriesModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: CafeteriaManager.name, schema: CafeteriaManagerSchema },
      { name: Cafeteria.name, schema: CafeteriaSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
