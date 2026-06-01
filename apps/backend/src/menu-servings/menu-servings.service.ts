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
import { CafeteriaManager } from "../cafeteria-managers/schemas/cafeteria-manager.schema";
import { Cafeteria } from "../cafeterias/schemas/cafeteria.schema";
import { PaginatedData } from "../common/api-response";
import {
  AllergyCode,
  MEAL_TIMES,
  MENU_SERVING_STATUSES,
  ManagerPermission,
  ManagerRole,
  MealTime,
  MenuServingStatus,
  UserRole,
} from "../common/enums";
import { toObjectId } from "../common/object-id";
import { parsePagination } from "../common/pagination";
import { Meal } from "../meals/schemas/meal.schema";
import { User } from "../users/schemas/user.schema";
import { MenuServingEventsService } from "./menu-serving-events.service";
import { MenuServing } from "./schemas/menu-serving.schema";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface MenuServingListQuery {
  date?: string;
  cafeteriaId?: string;
  category?: string;
  mealTime?: string;
  q?: string;
  dietaryLabel?: string;
  hideAllergyConflicts?: string;
  page?: string;
  limit?: string;
}

export interface MenuServingCreateBody {
  mealId?: unknown;
  cafeteriaId?: unknown;
  date?: unknown;
  mealTime?: unknown;
  price?: unknown;
  status?: unknown;
  stock?: unknown;
}

export interface MenuServingStatusBody {
  status?: unknown;
}

@Injectable()
export class MenuServingsService {
  constructor(
    @InjectModel(MenuServing.name)
    private readonly menuServingModel: Model<MenuServing>,
    @InjectModel(Meal.name)
    private readonly mealModel: Model<Meal>,
    @InjectModel(Cafeteria.name)
    private readonly cafeteriaModel: Model<Cafeteria>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(CafeteriaManager.name)
    private readonly cafeteriaManagerModel: Model<CafeteriaManager>,
    private readonly authService: AuthService,
    private readonly menuServingEventsService: MenuServingEventsService,
  ) {}

  async findAll(
    query: MenuServingListQuery,
    authorization?: string,
  ): Promise<PaginatedData<Record<string, unknown>>> {
    const viewerAllergies = await this.resolveViewerAllergies(authorization);
    const { page, limit, skip } = parsePagination(query as Record<string, unknown>);
    const filter = await this.buildServingFilter(query, viewerAllergies);
    const mealIdFilter = filter.mealId as { $in?: Types.ObjectId[] } | undefined;

    if (mealIdFilter?.$in?.length === 0) {
      return { items: [], page, limit, total: 0 };
    }

    const [items, total] = await Promise.all([
      this.menuServingModel
        .find(filter)
        .sort({ date: 1, mealTime: 1, cafeteriaId: 1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "mealId",
          select: "name description category imageUrl ingredients allergens dietaryLabels nutrition",
        })
        .populate({
          path: "cafeteriaId",
          select: "name description location openingHours",
        })
        .lean()
        .exec(),
      this.menuServingModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((serving) => this.toResponse(serving, viewerAllergies)),
      page,
      limit,
      total,
    };
  }

  async findById(menuServingId: string, authorization?: string) {
    const viewerAllergies = await this.resolveViewerAllergies(authorization);
    const _id = toObjectId(menuServingId, "menuServingId");
    const serving = await this.menuServingModel
      .findOne({ _id, status: { $ne: MenuServingStatus.HIDDEN } })
      .populate({
        path: "mealId",
        select: "name description category imageUrl ingredients allergens dietaryLabels nutrition",
      })
      .populate({
        path: "cafeteriaId",
        match: { isActive: true },
        select: "name description location openingHours",
      })
      .lean()
      .exec();

    if (!serving || !this.hasPublicCafeteria(serving.cafeteriaId)) {
      throw new NotFoundException("menu serving not found");
    }

    return this.toResponse(serving, viewerAllergies);
  }

  async create(authorization: string | undefined, body?: MenuServingCreateBody) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    const normalized = this.normalizeCreateBody(body);

    await this.assertCanManageCafeteria(
      currentUser,
      normalized.cafeteriaId,
      ManagerPermission.MENU_WRITE,
    );
    await Promise.all([
      this.requireActiveCafeteria(normalized.cafeteriaId),
      this.requireMeal(normalized.mealId),
    ]);

    try {
      const serving = await this.menuServingModel.create({
        ...normalized,
        createdBy: new Types.ObjectId(currentUser.id),
      });
      return this.toResponse(await this.findServingForManagerResponse(serving._id as Types.ObjectId), null);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException("menu serving already exists");
      }
      throw error;
    }
  }

  async updateStatus(
    menuServingId: string,
    authorization: string | undefined,
    body?: MenuServingStatusBody,
  ) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    const _id = toObjectId(menuServingId, "menuServingId");
    const status = this.normalizeStatusBody(body);
    const existingServing = await this.menuServingModel.findById(_id).lean().exec();

    if (!existingServing) {
      throw new NotFoundException("menu serving not found");
    }

    await this.assertCanManageCafeteria(
      currentUser,
      existingServing.cafeteriaId as Types.ObjectId,
      ManagerPermission.STATUS_WRITE,
    );

    const serving = await this.menuServingModel
      .findByIdAndUpdate(_id, { $set: { status } }, { returnDocument: "after", runValidators: true })
      .populate({
        path: "mealId",
        select: "name description category imageUrl ingredients allergens dietaryLabels nutrition",
      })
      .populate({
        path: "cafeteriaId",
        select: "name description location openingHours",
      })
      .lean()
      .exec();

    if (!serving) {
      throw new NotFoundException("menu serving not found");
    }

    const response = this.toResponse(serving, null);
    this.menuServingEventsService.publishStatusUpdate({
      menuServingId: serving._id.toString(),
      status: serving.status,
      updatedAt: new Date().toISOString(),
    });

    return response;
  }

  private async buildServingFilter(
    query: MenuServingListQuery,
    viewerAllergies: AllergyCode[] | null,
  ): Promise<Record<string, unknown>> {
    const filter: Record<string, unknown> = {
      status: { $ne: MenuServingStatus.HIDDEN },
    };

    if (query.date?.trim()) {
      filter.date = query.date.trim();
    }

    if (query.cafeteriaId?.trim()) {
      const cafeteriaId = toObjectId(query.cafeteriaId.trim(), "cafeteriaId");
      const cafeteria = await this.cafeteriaModel
        .findOne({ _id: cafeteriaId, isActive: true })
        .select("_id")
        .lean()
        .exec();
      filter.cafeteriaId = cafeteria ? cafeteriaId : { $in: [] };
    } else {
      const cafeterias = await this.cafeteriaModel.find({ isActive: true }).select("_id").lean().exec();
      filter.cafeteriaId = { $in: cafeterias.map((cafeteria) => cafeteria._id as Types.ObjectId) };
    }

    if (query.mealTime?.trim()) {
      filter.mealTime = query.mealTime.trim();
    }

    const mealFilter = this.buildMealFilter(query, viewerAllergies);
    if (Object.keys(mealFilter).length > 0) {
      const meals = await this.mealModel.find(mealFilter).select("_id").lean().exec();
      filter.mealId = { $in: meals.map((meal) => meal._id as Types.ObjectId) };
    }

    return filter;
  }

  private buildMealFilter(
    query: MenuServingListQuery,
    viewerAllergies: AllergyCode[] | null,
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (query.q?.trim()) {
      filter.$text = { $search: query.q.trim() };
    }

    if (query.category?.trim()) {
      filter.category = query.category.trim();
    }

    if (query.dietaryLabel?.trim()) {
      filter.dietaryLabels = query.dietaryLabel.trim();
    }

    if (
      query.hideAllergyConflicts === "true" &&
      viewerAllergies &&
      viewerAllergies.length > 0
    ) {
      filter.allergens = { $nin: viewerAllergies };
    }

    return filter;
  }

  private async assertCanManageCafeteria(
    currentUser: AuthenticatedUser,
    cafeteriaId: Types.ObjectId,
    permission: ManagerPermission,
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
        $or: [{ managerRole: ManagerRole.OWNER }, { permissions: permission }],
      })
      .select("_id")
      .lean()
      .exec();

    if (!manager) {
      throw new ForbiddenException(`${permission} permission required`);
    }
  }

  private async requireActiveCafeteria(cafeteriaId: Types.ObjectId) {
    const cafeteria = await this.cafeteriaModel
      .findOne({ _id: cafeteriaId, isActive: true })
      .select("_id")
      .lean()
      .exec();

    if (!cafeteria) {
      throw new NotFoundException("cafeteria not found");
    }
  }

  private async requireMeal(mealId: Types.ObjectId) {
    const meal = await this.mealModel.findById(mealId).select("_id").lean().exec();

    if (!meal) {
      throw new NotFoundException("meal not found");
    }
  }

  private async findServingForManagerResponse(servingId: Types.ObjectId) {
    const serving = await this.menuServingModel
      .findById(servingId)
      .populate({
        path: "mealId",
        select: "name description category imageUrl ingredients allergens dietaryLabels nutrition",
      })
      .populate({
        path: "cafeteriaId",
        select: "name description location openingHours",
      })
      .lean()
      .exec();

    if (!serving) {
      throw new NotFoundException("menu serving not found");
    }

    return serving;
  }

  private normalizeCreateBody(body?: MenuServingCreateBody) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("request body is required");
    }

    return {
      mealId: toObjectId(this.requiredString(body.mealId, "mealId"), "mealId"),
      cafeteriaId: toObjectId(this.requiredString(body.cafeteriaId, "cafeteriaId"), "cafeteriaId"),
      date: this.normalizeDate(body.date),
      mealTime: this.normalizeEnum(body.mealTime, "mealTime", MEAL_TIMES) as MealTime,
      price: this.normalizeNonNegativeNumber(body.price, "price"),
      status: this.normalizeOptionalEnum(
        body.status,
        "status",
        MENU_SERVING_STATUSES,
        MenuServingStatus.AVAILABLE,
      ) as MenuServingStatus,
      stock: this.normalizeOptionalNonNegativeInteger(body.stock, "stock"),
    };
  }

  private normalizeStatusBody(body?: MenuServingStatusBody): MenuServingStatus {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("request body is required");
    }

    return this.normalizeEnum(body.status, "status", MENU_SERVING_STATUSES) as MenuServingStatus;
  }

  private requiredString(value: unknown, fieldName: string) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return value.trim();
  }

  private normalizeDate(value: unknown) {
    if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
      throw new BadRequestException("date must use YYYY-MM-DD format");
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException("date must be a valid calendar date");
    }

    return value;
  }

  private normalizeEnum(value: unknown, fieldName: string, allowedValues: string[]) {
    if (typeof value !== "string" || !allowedValues.includes(value)) {
      throw new BadRequestException(`${fieldName} contains invalid value`);
    }
    return value;
  }

  private normalizeOptionalEnum(
    value: unknown,
    fieldName: string,
    allowedValues: string[],
    fallback: string,
  ) {
    if (value === undefined || value === null) {
      return fallback;
    }
    return this.normalizeEnum(value, fieldName, allowedValues);
  }

  private normalizeNonNegativeNumber(value: unknown, fieldName: string) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${fieldName} must be a non-negative number`);
    }
    return value;
  }

  private normalizeOptionalNonNegativeInteger(
    value: unknown,
    fieldName: string,
  ): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new BadRequestException(`${fieldName} must be a non-negative integer`);
    }
    return value;
  }

  private toResponse(serving: any, viewerAllergies: AllergyCode[] | null) {
    const meal = serving.mealId;
    const cafeteria = serving.cafeteriaId;
    const response: Record<string, unknown> = {
      id: serving._id.toString(),
      date: serving.date,
      mealTime: serving.mealTime,
      price: serving.price,
      status: serving.status,
      stock: serving.stock,
      averageRating: serving.averageRating,
      verifiedReviewCount: serving.verifiedReviewCount,
      cafeteria: this.toCafeteriaSummary(cafeteria),
      meal: this.toMealSummary(meal),
    };

    if (viewerAllergies) {
      response.allergyWarning = this.buildAllergyWarning(meal, viewerAllergies);
    }

    return response;
  }

  private async resolveViewerAllergies(
    authorization?: string,
  ): Promise<AllergyCode[] | null> {
    if (!authorization?.trim()) {
      return null;
    }

    const currentUser = await this.authService.requireUser(authorization);
    const user = await this.userModel
      .findById(currentUser.id)
      .select("dietaryProfile.allergies")
      .lean()
      .exec();

    return user?.dietaryProfile?.allergies ?? [];
  }

  private buildAllergyWarning(meal: any, viewerAllergies: AllergyCode[]) {
    if (!meal || meal instanceof Types.ObjectId || viewerAllergies.length === 0) {
      return {
        hasConflict: false,
        matchedAllergens: [],
      };
    }

    const viewerAllergySet = new Set(viewerAllergies);
    const matchedAllergens = ((meal.allergens ?? []) as AllergyCode[]).filter(
      (allergen) => viewerAllergySet.has(allergen),
    );

    return {
      hasConflict: matchedAllergens.length > 0,
      matchedAllergens,
    };
  }

  private toCafeteriaSummary(cafeteria: any) {
    if (!cafeteria || cafeteria instanceof Types.ObjectId) {
      return { id: cafeteria?.toString?.() };
    }

    return {
      id: cafeteria._id.toString(),
      name: cafeteria.name,
      description: cafeteria.description,
      location: cafeteria.location ?? {},
      openingHours: cafeteria.openingHours ?? {},
    };
  }

  private hasPublicCafeteria(cafeteria: any): boolean {
    return Boolean(cafeteria && !(cafeteria instanceof Types.ObjectId));
  }

  private toMealSummary(meal: any) {
    if (!meal || meal instanceof Types.ObjectId) {
      return { id: meal?.toString?.() };
    }

    return {
      id: meal._id.toString(),
      name: meal.name,
      description: meal.description,
      category: meal.category,
      imageUrl: meal.imageUrl,
      ingredients: meal.ingredients ?? [],
      allergens: meal.allergens ?? [],
      dietaryLabels: meal.dietaryLabels ?? [],
      nutrition: meal.nutrition ?? {},
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
