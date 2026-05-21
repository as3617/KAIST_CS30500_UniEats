import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import {
  ALLERGY_CODES,
  DIETARY_LABEL_CODES,
  AllergyCode,
  DietaryLabelCode,
  UserRole,
  USER_ROLES,
} from "../../common/enums";

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class DietaryProfile {
  @Prop({ type: [String], enum: ALLERGY_CODES, default: [] })
  allergies: AllergyCode[];

  @Prop({ type: [String], default: [] })
  preferredIngredients: string[];

  @Prop({ type: [String], default: [] })
  dislikedIngredients: string[];

  @Prop({ type: [String], enum: DIETARY_LABEL_CODES, default: [] })
  dietaryLabels: DietaryLabelCode[];
}

export const DietaryProfileSchema = SchemaFactory.createForClass(DietaryProfile);

@Schema({ _id: false })
export class ReviewStats {
  @Prop({ type: Number, default: 0, min: 0 })
  verifiedReviewCount: number;
}

export const ReviewStatsSchema = SchemaFactory.createForClass(ReviewStats);

@Schema({ collection: "users", timestamps: true })
export class User {
  @Prop({
    required: true,
    lowercase: true,
    trim: true,
    match: /^[^@\s]+@kaist\.ac\.kr$/,
  })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  nickname: string;

  @Prop({ type: String, enum: USER_ROLES, required: true, default: UserRole.USER })
  role: UserRole;

  @Prop({ type: Boolean, default: false })
  isEmailVerified: boolean;

  @Prop({ type: DietaryProfileSchema, default: () => ({}) })
  dietaryProfile: DietaryProfile;

  @Prop({ type: ReviewStatsSchema, default: () => ({}) })
  reviewStats: ReviewStats;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });
