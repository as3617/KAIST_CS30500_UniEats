import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AuthenticatedUser, AuthService } from "../auth/auth.service";
import { CafeteriaManager } from "../cafeteria-managers/schemas/cafeteria-manager.schema";
import { Cafeteria } from "../cafeterias/schemas/cafeteria.schema";
import {
  ManagerPermission,
  ManagerRole,
  UserRole,
} from "../common/enums";
import { toObjectId } from "../common/object-id";
import { MenuServing } from "../menu-servings/schemas/menu-serving.schema";
import { Discount } from "./schemas/discount.schema";

export interface DiscountWriteBody {
  cafeteriaId?: unknown;
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
    @InjectModel(MenuServing.name)
    private readonly menuServingModel: Model<MenuServing>,
    @InjectModel(CafeteriaManager.name)
    private readonly cafeteriaManagerModel: Model<CafeteriaManager>,
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
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    const cafeteriaFilter = await this.buildManageableCafeteriaFilter(currentUser);
    const items = await this.discountModel
      .find(cafeteriaFilter)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return items.map((item) => this.toResponse(item));
  }

  async create(authorization: string | undefined, body?: DiscountWriteBody) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    const data = await this.normalizeBody(body);
    if (!data.cafeteriaId) {
      throw new BadRequestException("cafeteriaId is required");
    }
    await this.assertCanManageCafeteria(currentUser, data.cafeteriaId);

    const discount = await this.discountModel.create(data);
    return this.toResponse(discount.toObject());
  }

  async update(
    discountId: string,
    authorization: string | undefined,
    body?: DiscountWriteBody,
  ) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    const _id = toObjectId(discountId, "discountId");
    const existing = await this.discountModel.findById(_id).lean().exec();

    if (!existing) {
      throw new NotFoundException("discount not found");
    }

    const existingCafeteriaId = this.objectIdFromValue(existing.cafeteriaId);
    if (!existingCafeteriaId) {
      await this.requireAdmin(currentUser);
    } else {
      await this.assertCanManageCafeteria(currentUser, existingCafeteriaId);
    }

    const data = await this.normalizeBody(body, { partial: true });
    if (data.cafeteriaId) {
      await this.assertCanManageCafeteria(currentUser, data.cafeteriaId);
    }

    const updated = await this.discountModel
      .findByIdAndUpdate(_id, { $set: data }, { new: true, runValidators: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException("discount not found");
    return this.toResponse(updated);
  }

  async remove(discountId: string, authorization: string | undefined) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    const _id = toObjectId(discountId, "discountId");
    const existing = await this.discountModel.findById(_id).lean().exec();

    if (!existing) {
      throw new NotFoundException("discount not found");
    }

    const cafeteriaId = this.objectIdFromValue(existing.cafeteriaId);
    if (!cafeteriaId) {
      await this.requireAdmin(currentUser);
    } else {
      await this.assertCanManageCafeteria(currentUser, cafeteriaId);
    }

    await this.discountModel.deleteOne({ _id }).exec();
  }

  private async buildManageableCafeteriaFilter(currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.ADMIN) {
      return {};
    }

    if (currentUser.role !== UserRole.MANAGER) {
      throw new ForbiddenException("manager role required");
    }

    const managerRows = await this.cafeteriaManagerModel
      .find({
        userId: new Types.ObjectId(currentUser.id),
        isActive: true,
        $or: [
          { managerRole: ManagerRole.OWNER },
          { permissions: ManagerPermission.MENU_WRITE },
        ],
      })
      .select("cafeteriaId")
      .lean()
      .exec();
    const cafeteriaIds = managerRows
      .map((manager) => this.objectIdFromValue(manager.cafeteriaId))
      .filter((cafeteriaId): cafeteriaId is Types.ObjectId => Boolean(cafeteriaId));

    if (cafeteriaIds.length === 0) {
      return { cafeteriaId: { $in: [] } };
    }

    return { cafeteriaId: { $in: cafeteriaIds } };
  }

  private async assertCanManageCafeteria(
    currentUser: AuthenticatedUser,
    cafeteriaId: Types.ObjectId,
  ) {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role !== UserRole.MANAGER) {
      throw new ForbiddenException("manager role required");
    }

    const manager = await this.cafeteriaManagerModel
      .findOne({
        userId: new Types.ObjectId(currentUser.id),
        cafeteriaId,
        isActive: true,
        $or: [
          { managerRole: ManagerRole.OWNER },
          { permissions: ManagerPermission.MENU_WRITE },
        ],
      })
      .select("_id")
      .lean()
      .exec();

    if (!manager) {
      throw new ForbiddenException("MENU_WRITE permission required");
    }
  }

  private async requireAdmin(currentUser: AuthenticatedUser) {
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException("admin only");
    }
  }

  private async normalizeBody(
    body?: DiscountWriteBody,
    options?: { partial?: boolean },
  ) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("request body is required");
    }

    const partial = options?.partial ?? false;
    const result: {
      cafeteriaId?: Types.ObjectId;
      cafeteriaName?: string;
      menuName?: string;
      discountedPrice?: number;
      menuServingId?: Types.ObjectId;
      validUntil?: Date;
      isActive?: boolean;
    } = {};

    if (body.menuServingId !== undefined || !partial) {
      const menuServingId = toObjectId(
        this.requiredString(body.menuServingId, "menuServingId"),
        "menuServingId",
      );
      const serving = await this.findDiscountableMenuServing(menuServingId);
      const servingCafeteriaId = this.objectIdFromValue(serving.cafeteriaId)!;
      const requestedCafeteriaId =
        body.cafeteriaId !== undefined
          ? toObjectId(this.requiredString(body.cafeteriaId, "cafeteriaId"), "cafeteriaId")
          : servingCafeteriaId;

      if (requestedCafeteriaId.toString() !== servingCafeteriaId.toString()) {
        throw new BadRequestException("menuServingId does not belong to cafeteriaId");
      }

      result.cafeteriaId = servingCafeteriaId;
      result.cafeteriaName = this.populatedName(serving.cafeteriaId) ?? "Cafeteria";
      result.menuName = this.populatedName(serving.mealId) ?? "Menu";
      result.menuServingId = menuServingId;
    } else if (body.cafeteriaId !== undefined) {
      throw new BadRequestException("menuServingId is required when changing cafeteriaId");
    }

    if (body.discountedPrice !== undefined || !partial) {
      const value = Number(body.discountedPrice);
      if (body.discountedPrice === undefined || !Number.isFinite(value) || value < 0) {
        throw new BadRequestException("discountedPrice must be a non-negative number");
      }
      result.discountedPrice = value;
    }

    if (body.validUntil !== undefined || !partial) {
      const raw = body.validUntil;
      const date = raw ? new Date(raw as string) : null;
      if (!date || isNaN(date.getTime())) {
        throw new BadRequestException("validUntil must be a valid date");
      }
      result.validUntil = date;
    }

    if (body.isActive !== undefined) {
      result.isActive = this.parseBoolean(body.isActive, "isActive");
    }

    return result;
  }

  private async findDiscountableMenuServing(menuServingId: Types.ObjectId) {
    const serving = await this.menuServingModel
      .findById(menuServingId)
      .populate({ path: "mealId", select: "name" })
      .populate({ path: "cafeteriaId", select: "name isActive" })
      .lean()
      .exec();

    if (!serving) {
      throw new NotFoundException("menu serving not found");
    }

    const cafeteria = serving.cafeteriaId as Partial<Cafeteria> | null;
    if (cafeteria && cafeteria.isActive === false) {
      throw new NotFoundException("cafeteria not found");
    }

    return serving as any;
  }

  private requiredString(value: unknown, fieldName: string) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return value.trim();
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
      cafeteriaId: this.objectIdToString(discount.cafeteriaId),
      cafeteriaName: discount.cafeteriaName,
      menuName: discount.menuName,
      discountedPrice: discount.discountedPrice,
      menuServingId: this.objectIdToString(discount.menuServingId),
      validUntil: discount.validUntil,
      isActive: discount.isActive,
      createdAt: discount.createdAt,
    };
  }

  private objectIdFromValue(value: unknown): Types.ObjectId | undefined {
    if (!value) {
      return undefined;
    }
    if (value instanceof Types.ObjectId) {
      return value;
    }
    if (typeof value === "string" && Types.ObjectId.isValid(value)) {
      return new Types.ObjectId(value);
    }
    if (typeof value === "object" && "_id" in value) {
      return this.objectIdFromValue((value as { _id?: unknown })._id);
    }
    return undefined;
  }

  private objectIdToString(value: unknown) {
    return this.objectIdFromValue(value)?.toString() ?? null;
  }

  private populatedName(value: unknown): string | undefined {
    if (!value || value instanceof Types.ObjectId) {
      return undefined;
    }
    if (typeof value === "object" && "name" in value) {
      const name = (value as { name?: unknown }).name;
      return typeof name === "string" ? name : undefined;
    }
    return undefined;
  }
}
