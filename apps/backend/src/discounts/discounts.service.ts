import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuthService } from "../auth/auth.service";
import { UserRole } from "../common/enums";
import { toObjectId } from "../common/object-id";
import { Discount } from "./schemas/discount.schema";

export interface DiscountWriteBody {
  cafeteriaName?: unknown;
  menuName?: unknown;
  discountedPrice?: unknown;
  menuServingId?: unknown;
  validUntil?: unknown;
  isActive?: unknown;
}

type DiscountResponseSource = Partial<Discount> & {
  _id: unknown;
  createdAt?: unknown;
};

@Injectable()
export class DiscountsService {
  constructor(
    @InjectModel(Discount.name)
    private readonly discountModel: Model<Discount>,
    private readonly authService: AuthService,
  ) {}

  async findAll() {
    const now = new Date();
    const items = await this.discountModel
      .find({ isActive: true, validUntil: { $gte: now } })
      .sort({ validUntil: 1 })
      .lean()
      .exec();
    return items.map((item) => this.toResponse(item));
  }

  async findAllAdmin(authorization: string | undefined) {
    await this.requireAdmin(authorization);
    const items = await this.discountModel.find().sort({ createdAt: -1 }).lean().exec();
    return items.map((item) => this.toResponse(item));
  }

  async create(authorization: string | undefined, body?: DiscountWriteBody) {
    await this.requireAdmin(authorization);
    const data = this.normalizeBody(body);
    const discount = await this.discountModel.create(data);
    return this.toResponse(discount.toObject());
  }

  async update(discountId: string, authorization: string | undefined, body?: DiscountWriteBody) {
    await this.requireAdmin(authorization);
    const _id = toObjectId(discountId, "discountId");
    const data = this.normalizeBody(body, { partial: true });
    const updated = await this.discountModel
      .findByIdAndUpdate(_id, { $set: data }, { new: true, runValidators: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException("discount not found");
    return this.toResponse(updated);
  }

  async remove(discountId: string, authorization: string | undefined) {
    await this.requireAdmin(authorization);
    const _id = toObjectId(discountId, "discountId");
    const deleted = await this.discountModel.findByIdAndDelete(_id).lean().exec();
    if (!deleted) throw new NotFoundException("discount not found");
  }

  private async requireAdmin(authorization: string | undefined) {
    const user = await this.authService.requireUser(authorization);
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("admin only");
    }
  }

  private normalizeBody(body?: DiscountWriteBody, options?: { partial?: boolean }) {
    const partial = options?.partial ?? false;
    const result: Record<string, unknown> = {};

    if (body?.cafeteriaName !== undefined || !partial) {
      const value = typeof body?.cafeteriaName === "string" ? body.cafeteriaName.trim() : undefined;
      if (!partial && !value) throw new BadRequestException("cafeteriaName is required");
      if (value) result.cafeteriaName = value;
    }

    if (body?.menuName !== undefined || !partial) {
      const value = typeof body?.menuName === "string" ? body.menuName.trim() : undefined;
      if (!partial && !value) throw new BadRequestException("menuName is required");
      if (value) result.menuName = value;
    }

    if (body?.discountedPrice !== undefined || !partial) {
      const value = Number(body?.discountedPrice);
      if (body?.discountedPrice === undefined || isNaN(value) || value < 0) {
        throw new BadRequestException("discountedPrice must be a non-negative number");
      }
      result.discountedPrice = value;
    }

    if (body?.validUntil !== undefined || !partial) {
      const raw = body?.validUntil;
      const date = raw ? new Date(raw as string) : null;
      if (!date || isNaN(date.getTime())) {
        throw new BadRequestException("validUntil must be a valid date");
      }
      result.validUntil = date;
    }

    if (body?.menuServingId !== undefined) {
      if (body.menuServingId === null) {
        result.menuServingId = undefined;
      } else if (typeof body.menuServingId === "string") {
        result.menuServingId = body.menuServingId.trim() || undefined;
      } else {
        throw new BadRequestException("menuServingId must be a string");
      }
    }

    if (body?.isActive !== undefined) {
      result.isActive = this.parseBoolean(body.isActive, "isActive");
    }

    return result;
  }

  private parseBoolean(value: unknown, fieldName: string) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
    throw new BadRequestException(`${fieldName} must be a boolean`);
  }

  private toResponse(discount: DiscountResponseSource) {
    return {
      id: String(discount._id),
      cafeteriaName: discount.cafeteriaName,
      menuName: discount.menuName,
      discountedPrice: discount.discountedPrice,
      menuServingId: discount.menuServingId ?? null,
      validUntil: discount.validUntil,
      isActive: discount.isActive,
      createdAt: discount.createdAt,
    };
  }
}
