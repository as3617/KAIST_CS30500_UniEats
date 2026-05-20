import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthToken, AuthTokenSchema } from "./schemas/auth-token.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: AuthToken.name, schema: AuthTokenSchema }])],
  exports: [MongooseModule],
})
export class AuthModule {}
