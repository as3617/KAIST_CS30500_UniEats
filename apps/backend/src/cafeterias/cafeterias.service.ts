import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AuthenticatedUser, AuthService } from "../auth/auth.service";
import {
  MANAGER_PERMISSIONS,
  MANAGER_ROLES,
  ManagerPermission,
  ManagerRole,
  UserRole,
} from "../common/enums";
import { toObjectId } from "../common/object-id";
import { CafeteriaManager } from "../cafeteria-managers/schemas/cafeteria-manager.schema";
import { User } from "../users/schemas/user.schema";
import { Cafeteria } from "./schemas/cafeteria.schema";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type Weekday = (typeof WEEKDAYS)[number];

type TimeRangeInput = {
  open?: unknown;
  close?: unknown;
};

export interface CafeteriaCreateBody {
  name?: unknown;
  description?: unknown;
  location?: unknown;
  openingHours?: unknown;
  isActive?: unknown;
}

export interface AssignCafeteriaManagerBody {
  userId?: unknown;
  managerRole?: unknown;
  permissions?: unknown;
}

export interface UpdateCafeteriaManagerBody {
  managerRole?: unknown;
  permissions?: unknown;
  isActive?: unknown;
}

@Injectable()
export class CafeteriasService {
  constructor(
    @InjectModel(Cafeteria.name)
    private readonly cafeteriaModel: Model<Cafeteria>,
    @InjectModel(CafeteriaManager.name)
    private readonly cafeteriaManagerModel: Model<CafeteriaManager>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly authService: AuthService,
  ) {}

  async findAll() {
    const cafeterias = await this.cafeteriaModel
      .find({ isActive: true })
      .sort({ name: 1 })
      .lean()
      .exec();

    return cafeterias.map((cafeteria) => this.toListItem(cafeteria));
  }

  async findById(cafeteriaId: string) {
    const _id = toObjectId(cafeteriaId, "cafeteriaId");
    const cafeteria = await this.cafeteriaModel.findOne({ _id, isActive: true }).lean().exec();

    if (!cafeteria) {
      throw new NotFoundException("cafeteria not found");
    }

    return this.toDetail(cafeteria);
  }

  async create(authorization: string | undefined, body?: CafeteriaCreateBody) {
    await this.requireAdmin(authorization);

    try {
      const cafeteria = await this.cafeteriaModel.create(this.normalizeCreateBody(body));
      return this.toDetail(cafeteria.toObject());
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException("cafeteria name already exists");
      }
      throw error;
    }
  }

  async findManagers(cafeteriaId: string, authorization?: string) {
    await this.requireAdmin(authorization);
    const cafeteriaObjectId = await this.requireCafeteria(cafeteriaId);

    const managers = await this.cafeteriaManagerModel
      .find({ cafeteriaId: cafeteriaObjectId })
      .sort({ managerRole: 1, userId: 1 })
      .populate({
        path: "userId",
        select: "email nickname role isEmailVerified",
      })
      .lean()
      .exec();

    return managers.map((manager) => this.toManagerResponse(manager));
  }

  async assignManager(
    cafeteriaId: string,
    authorization: string | undefined,
    body?: AssignCafeteriaManagerBody,
  ) {
    const currentUser = await this.requireAdmin(authorization);
    const cafeteriaObjectId = await this.requireCafeteria(cafeteriaId);
    const targetUserId = toObjectId(this.requiredString(body?.userId, "userId"), "userId");
    await this.requireManagerUser(targetUserId);

    const existing = await this.cafeteriaManagerModel
      .findOne({ cafeteriaId: cafeteriaObjectId, userId: targetUserId })
      .select("_id")
      .lean()
      .exec();

    if (existing) {
      throw new ConflictException("cafeteria manager already exists");
    }

    const manager = await this.cafeteriaManagerModel.create({
      cafeteriaId: cafeteriaObjectId,
      userId: targetUserId,
      managerRole: this.normalizeManagerRole(body?.managerRole, ManagerRole.STAFF),
      permissions: this.normalizePermissions(body?.permissions, true),
      isActive: true,
      assignedBy: new Types.ObjectId(currentUser.id),
    });

    return this.toManagerResponse(
      await manager.populate({
        path: "userId",
        select: "email nickname role isEmailVerified",
      }),
    );
  }

  async updateManager(
    cafeteriaId: string,
    userId: string,
    authorization: string | undefined,
    body?: UpdateCafeteriaManagerBody,
  ) {
    await this.requireAdmin(authorization);
    const cafeteriaObjectId = await this.requireCafeteria(cafeteriaId);
    const targetUserId = toObjectId(userId, "userId");

    const update = this.normalizeManagerUpdateBody(body);
    const manager = await this.cafeteriaManagerModel
      .findOneAndUpdate(
        { cafeteriaId: cafeteriaObjectId, userId: targetUserId },
        { $set: update },
        { returnDocument: "after", runValidators: true },
      )
      .populate({
        path: "userId",
        select: "email nickname role isEmailVerified",
      })
      .lean()
      .exec();

    if (!manager) {
      throw new NotFoundException("cafeteria manager not found");
    }

    return this.toManagerResponse(manager);
  }

  private async requireAdmin(authorization?: string): Promise<AuthenticatedUser> {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });

    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException("admin role required");
    }

    return currentUser;
  }

  private async requireCafeteria(cafeteriaId: string) {
    const cafeteriaObjectId = toObjectId(cafeteriaId, "cafeteriaId");
    const cafeteria = await this.cafeteriaModel
      .findOne({ _id: cafeteriaObjectId, isActive: true })
      .select("_id")
      .lean()
      .exec();

    if (!cafeteria) {
      throw new NotFoundException("cafeteria not found");
    }

    return cafeteriaObjectId;
  }

  private async requireManagerUser(userId: Types.ObjectId) {
    const user = await this.userModel
      .findOne({ _id: userId, role: UserRole.MANAGER })
      .select("_id")
      .lean()
      .exec();

    if (!user) {
      throw new BadRequestException("userId must belong to a manager user");
    }
  }

  private normalizeCreateBody(body?: CafeteriaCreateBody) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("request body is required");
    }

    return {
      name: this.normalizeRequiredString(body.name, "name", 120),
      description: this.normalizeOptionalString(body.description, "description", 1000),
      location: this.normalizeLocation(body.location),
      openingHours: this.normalizeOpeningHours(body.openingHours),
      isActive: this.normalizeOptionalBoolean(body.isActive, true, "isActive"),
    };
  }

  private normalizeManagerUpdateBody(body?: UpdateCafeteriaManagerBody) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("request body is required");
    }

    const update: Record<string, unknown> = {};

    if ("managerRole" in body) {
      update.managerRole = this.normalizeManagerRole(body.managerRole);
    }
    if ("permissions" in body) {
      update.permissions = this.normalizePermissions(body.permissions, true);
    }
    if ("isActive" in body) {
      update.isActive = this.normalizeRequiredBoolean(body.isActive, "isActive");
    }

    if (Object.keys(update).length === 0) {
      throw new BadRequestException("no updatable fields provided");
    }

    return update;
  }

  private normalizeLocation(value: unknown) {
    if (value === undefined) {
      return {};
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("location must be an object");
    }

    const location = value as Record<string, unknown>;
    return {
      building: this.normalizeOptionalString(location.building, "location.building", 80),
      floor: this.normalizeOptionalString(location.floor, "location.floor", 40),
      address: this.normalizeOptionalString(location.address, "location.address", 200),
      lat: this.normalizeOptionalNumber(location.lat, "location.lat"),
      lng: this.normalizeOptionalNumber(location.lng, "location.lng"),
    };
  }

  private normalizeOpeningHours(value: unknown) {
    if (value === undefined) {
      return {};
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("openingHours must be an object");
    }

    const input = value as Record<string, unknown>;
    const openingHours: Record<Weekday, Array<{ open: string; close: string }>> =
      {} as Record<Weekday, Array<{ open: string; close: string }>>;

    for (const weekday of WEEKDAYS) {
      if (!(weekday in input)) {
        continue;
      }
      if (!Array.isArray(input[weekday])) {
        throw new BadRequestException(`openingHours.${weekday} must be an array`);
      }
      openingHours[weekday] = (input[weekday] as TimeRangeInput[]).map((range) =>
        this.normalizeTimeRange(range, `openingHours.${weekday}`),
      );
    }

    return openingHours;
  }

  private normalizeTimeRange(value: TimeRangeInput, fieldName: string) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException(`${fieldName} items must be objects`);
    }

    const open = this.normalizeRequiredString(value.open, `${fieldName}.open`, 5);
    const close = this.normalizeRequiredString(value.close, `${fieldName}.close`, 5);
    if (!TIME_PATTERN.test(open) || !TIME_PATTERN.test(close)) {
      throw new BadRequestException(`${fieldName} must use HH:mm times`);
    }

    return { open, close };
  }

  private normalizeManagerRole(value: unknown, fallback?: ManagerRole): ManagerRole {
    if (value === undefined && fallback) {
      return fallback;
    }
    if (typeof value !== "string" || !MANAGER_ROLES.includes(value as ManagerRole)) {
      throw new BadRequestException("managerRole contains invalid value");
    }
    return value as ManagerRole;
  }

  private normalizePermissions(value: unknown, required: boolean): ManagerPermission[] {
    if (value === undefined && !required) {
      return [];
    }
    if (!Array.isArray(value)) {
      throw new BadRequestException("permissions must be an array");
    }

    const allowed = new Set<string>(MANAGER_PERMISSIONS);
    const permissions: ManagerPermission[] = [];

    for (const item of value) {
      if (typeof item !== "string" || !allowed.has(item)) {
        throw new BadRequestException("permissions contains invalid value");
      }
      if (!permissions.includes(item as ManagerPermission)) {
        permissions.push(item as ManagerPermission);
      }
    }

    return permissions;
  }

  private normalizeRequiredString(value: unknown, fieldName: string, maxLength: number) {
    const normalized = this.normalizeOptionalString(value, fieldName, maxLength);
    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return normalized;
  }

  private normalizeOptionalString(value: unknown, fieldName: string, maxLength: number) {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "string") {
      throw new BadRequestException(`${fieldName} must be a string`);
    }

    const normalized = value.trim();
    if (normalized.length > maxLength) {
      throw new BadRequestException(`${fieldName} must be at most ${maxLength} characters`);
    }

    return normalized || undefined;
  }

  private requiredString(value: unknown, fieldName: string) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return value.trim();
  }

  private normalizeOptionalNumber(value: unknown, fieldName: string) {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new BadRequestException(`${fieldName} must be a number`);
    }
    return value;
  }

  private normalizeOptionalBoolean(value: unknown, fallback: boolean, fieldName: string) {
    if (value === undefined || value === null) {
      return fallback;
    }
    return this.normalizeRequiredBoolean(value, fieldName);
  }

  private normalizeRequiredBoolean(value: unknown, fieldName: string) {
    if (typeof value !== "boolean") {
      throw new BadRequestException(`${fieldName} must be a boolean`);
    }
    return value;
  }

  private toListItem(cafeteria: any) {
    return {
      id: cafeteria._id.toString(),
      name: cafeteria.name,
      description: cafeteria.description,
      location: cafeteria.location ?? {},
      openingHours: cafeteria.openingHours ?? {},
    };
  }

  private toDetail(cafeteria: any) {
    return this.toListItem(cafeteria);
  }

  private toManagerResponse(manager: any) {
    return {
      id: manager._id.toString(),
      cafeteriaId: manager.cafeteriaId.toString(),
      user: this.toManagerUser(manager.userId),
      managerRole: manager.managerRole,
      permissions: manager.permissions ?? [],
      isActive: manager.isActive,
    };
  }

  private toManagerUser(user: any) {
    if (!user || user instanceof Types.ObjectId) {
      return { id: user?.toString?.() };
    }

    return {
      id: user._id.toString(),
      email: user.email,
      nickname: user.nickname,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    };
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === 11000
    );
  }
}
