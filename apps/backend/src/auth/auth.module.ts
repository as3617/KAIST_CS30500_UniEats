import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../users/schemas/user.schema";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthToken, AuthTokenSchema } from "./schemas/auth-token.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuthToken.name, schema: AuthTokenSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, MongooseModule],
})
export class AuthModule {}
