import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import {
  MANAGER_PERMISSIONS,
  MANAGER_ROLES,
  ManagerPermission,
  ManagerRole,
} from "../../common/enums";

export type CafeteriaManagerDocument = HydratedDocument<CafeteriaManager>;

@Schema({ collection: "cafeteria_managers", timestamps: true })
export class CafeteriaManager {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Cafeteria", required: true })
  cafeteriaId: Types.ObjectId;

  @Prop({ type: String, enum: MANAGER_ROLES, required: true, default: ManagerRole.STAFF })
  managerRole: ManagerRole;

  @Prop({ type: [String], enum: MANAGER_PERMISSIONS, default: [] })
  permissions: ManagerPermission[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  assignedBy: Types.ObjectId;
}

export const CafeteriaManagerSchema = SchemaFactory.createForClass(CafeteriaManager);

CafeteriaManagerSchema.index({ userId: 1, cafeteriaId: 1 }, { unique: true });
CafeteriaManagerSchema.index({ cafeteriaId: 1, isActive: 1 });
CafeteriaManagerSchema.index({ userId: 1, isActive: 1 });
