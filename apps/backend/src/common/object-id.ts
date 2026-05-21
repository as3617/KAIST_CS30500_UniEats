import { BadRequestException } from "@nestjs/common";
import { Types } from "mongoose";

export function toObjectId(value: string, fieldName: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestException(`${fieldName} must be a valid ObjectId`);
  }

  return new Types.ObjectId(value);
}
