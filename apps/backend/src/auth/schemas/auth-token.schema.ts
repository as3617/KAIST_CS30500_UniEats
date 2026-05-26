import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { AUTH_TOKEN_TYPES, AuthTokenType } from "../../common/enums";

export type AuthTokenDocument = HydratedDocument<AuthToken>;

@Schema({ collection: "auth_tokens", timestamps: true })
export class AuthToken {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: AUTH_TOKEN_TYPES, required: true })
  type: AuthTokenType;

  @Prop({ required: true })
  tokenHash: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date })
  usedAt?: Date;
}

export const AuthTokenSchema = SchemaFactory.createForClass(AuthToken);

AuthTokenSchema.index({ tokenHash: 1 }, { unique: true });
AuthTokenSchema.index({ userId: 1, type: 1 });
AuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
