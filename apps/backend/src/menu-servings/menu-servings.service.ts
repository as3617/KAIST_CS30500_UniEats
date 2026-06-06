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
  ALLERGY_CODES,
  AllergyCode,
  CATEGORY_CODES,
  DIETARY_LABEL_CODES,
  MEAL_TIMES,
  MENU_SERVING_STATUSES,
  CategoryCode,
  DietaryLabelCode,
  ManagerPermission,
  ManagerRole,
  MealTime,
  MenuServingStatus,
  NotificationResourceType,
  NotificationType,
  UserRole,
} from "../common/enums";
import { toObjectId } from "../common/object-id";
import { parsePagination } from "../common/pagination";
import { Favorite } from "../favorites/schemas/favorite.schema";
import { Meal } from "../meals/schemas/meal.schema";
import { NotificationsService } from "../notifications/notifications.service";
import { User } from "../users/schemas/user.schema";
import { MenuServingEventsService } from "./menu-serving-events.service";
import { MenuServing } from "./schemas/menu-serving.schema";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NUTRITION_FIELDS = ["calories", "carbohydrate", "protein", "fat", "sodium"] as const;
const PREFERRED_INGREDIENT_MATCH_CAP = 3;
const DISLIKED_INGREDIENT_MATCH_CAP = 3;
const PREFERRED_INGREDIENT_SORT_BOOST = 0.15;
const DISLIKED_INGREDIENT_SORT_PENALTY = 0.25;

type ViewerDietaryProfile = {
  allergies: AllergyCode[];
  preferredIngredients: string[];
  dislikedIngredients: string[];
};

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

export interface MenuServingWithMealCreateBody {
  meal?: {
    name?: unknown;
    description?: unknown;
    category?: unknown;
    imageUrl?: unknown;
    ingredients?: unknown;
    allergens?: unknown;
    dietaryLabels?: unknown;
    nutrition?: unknown;
  };
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
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<Favorite>,
    private readonly authService: AuthService,
    private readonly menuServingEventsService: MenuServingEventsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(
    query: MenuServingListQuery,
    authorization?: string,
  ): Promise<PaginatedData<Record<string, unknown>>> {
    const viewerProfile = await this.resolveViewerDietaryProfile(authorization);
    const viewerAllergies = viewerProfile?.allergies ?? null;
    const { page, limit, skip } = parsePagination(query as Record<string, unknown>);
    const filter = await this.buildServingFilter(query, viewerAllergies);
    const mealIdFilter = filter.mealId as { $in?: Types.ObjectId[] } | undefined;

    if (mealIdFilter?.$in?.length === 0) {
      return { items: [], page, limit, total: 0 };
    }

    if (this.hasIngredientPreferences(viewerProfile)) {
      const [items, total] = await Promise.all([
        this.menuServingModel
          .find(filter)
          .sort({ date: 1, mealTime: 1, cafeteriaId: 1 })
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
      const rankedItems = this.sortByIngredientPreferences(items, viewerProfile);

      return {
        items: rankedItems
          .slice(skip, skip + limit)
          .map((serving) => this.toResponse(serving, viewerAllergies)),
        page,
        limit,
        total,
      };
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
    const viewerProfile = await this.resolveViewerDietaryProfile(authorization);
    const viewerAllergies = viewerProfile?.allergies ?? null;
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

  async createWithMeal(
    authorization: string | undefined,
    body?: MenuServingWithMealCreateBody,
  ) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    const normalized = this.normalizeCreateWithMealBody(body);

    await this.assertCanManageCafeteria(
      currentUser,
      normalized.serving.cafeteriaId,
      ManagerPermission.MENU_WRITE,
    );
    await this.requireActiveCafeteria(normalized.serving.cafeteriaId);

    const createdBy = new Types.ObjectId(currentUser.id);
    let createdMeal: { _id?: Types.ObjectId } | null = null;

    try {
      createdMeal = await this.mealModel.create({
        ...normalized.meal,
        createdBy,
      });
      const serving = await this.menuServingModel.create({
        ...normalized.serving,
        mealId: createdMeal._id,
        createdBy,
      });

      return this.toResponse(
        await this.findServingForManagerResponse(serving._id as Types.ObjectId),
        null,
      );
    } catch (error) {
      if (createdMeal?._id) {
        await this.mealModel.deleteOne({ _id: createdMeal._id }).exec().catch(() => undefined);
      }
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

    if (
      existingServing.status !== serving.status &&
      serving.status !== MenuServingStatus.HIDDEN
    ) {
      await this.notifyFavoriteUsersOfStatusUpdate(serving);
    }

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

  private async notifyFavoriteUsersOfStatusUpdate(serving: any) {
    const mealId = this.objectIdFromPopulated(serving.mealId);
    if (!mealId) {
      return;
    }

    const favorites = await this.favoriteModel
      .find({ mealId })
      .select("userId")
      .lean()
      .exec();

    const userIds = favorites.map((favorite) => favorite.userId as Types.ObjectId);
    if (userIds.length === 0) {
      return;
    }

    const mealName = this.populatedName(serving.mealId) ?? "즐겨찾기 메뉴";
    const cafeteriaName = this.populatedName(serving.cafeteriaId) ?? "식당";
    const statusLabel =
      serving.status === MenuServingStatus.SOLD_OUT ? "품절" : "판매 가능";

    await this.notificationsService.createForUsers({
      userIds,
      type: NotificationType.MENU_STATUS_UPDATED,
      title: `${mealName} 상태가 변경되었습니다.`,
      message: `${cafeteriaName}의 ${mealName} 메뉴가 ${statusLabel} 상태로 변경되었습니다.`,
      resourceType: NotificationResourceType.MENU_SERVING,
      resourceId: serving._id as Types.ObjectId,
    });
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

  private normalizeCreateWithMealBody(body?: MenuServingWithMealCreateBody) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("request body is required");
    }
    if (!body.meal || typeof body.meal !== "object" || Array.isArray(body.meal)) {
      throw new BadRequestException("meal must be an object");
    }

    return {
      meal: this.normalizeMealCreateBody(body.meal),
      serving: {
        cafeteriaId: toObjectId(
          this.requiredString(body.cafeteriaId, "cafeteriaId"),
          "cafeteriaId",
        ),
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
      },
    };
  }

  private normalizeMealCreateBody(meal: NonNullable<MenuServingWithMealCreateBody["meal"]>) {
    return {
      name: this.normalizeRequiredString(meal.name, "meal.name", 120),
      description: this.normalizeOptionalString(meal.description, "meal.description", 1000),
      category: this.normalizeEnum(meal.category, "meal.category", CATEGORY_CODES) as CategoryCode,
      imageUrl: this.normalizeOptionalString(meal.imageUrl, "meal.imageUrl", 1000),
      ingredients: this.normalizeStringArray(meal.ingredients, "meal.ingredients", false),
      allergens: this.normalizeEnumArray(
        meal.allergens,
        "meal.allergens",
        ALLERGY_CODES,
      ) as AllergyCode[],
      dietaryLabels: this.normalizeEnumArray(
        meal.dietaryLabels,
        "meal.dietaryLabels",
        DIETARY_LABEL_CODES,
      ) as DietaryLabelCode[],
      nutrition: this.normalizeNutrition(meal.nutrition, false),
    };
  }

  private normalizeStatusBody(body?: MenuServingStatusBody): MenuServingStatus {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("request body is required");
    }

    return this.normalizeEnum(body.status, "status", MENU_SERVING_STATUSES) as MenuServingStatus;
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

  private normalizeStringArray(value: unknown, fieldName: string, required: boolean) {
    if (value === undefined && !required) {
      return [];
    }
    if (!Array.isArray(value)) {
      throw new BadRequestException(`${fieldName} must be an array`);
    }

    const items: string[] = [];
    for (const item of value) {
      const normalized = this.normalizeRequiredString(item, fieldName, 120);
      if (!items.includes(normalized)) {
        items.push(normalized);
      }
    }
    return items;
  }

  private normalizeEnumArray(value: unknown, fieldName: string, allowedValues: string[]) {
    if (value === undefined) {
      return [];
    }
    if (!Array.isArray(value)) {
      throw new BadRequestException(`${fieldName} must be an array`);
    }

    const values: string[] = [];
    for (const item of value) {
      const normalized = this.normalizeEnum(item, fieldName, allowedValues);
      if (!values.includes(normalized)) {
        values.push(normalized);
      }
    }
    return values;
  }

  private normalizeNutrition(value: unknown, required: boolean) {
    if (value === undefined && !required) {
      return {};
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("meal.nutrition must be an object");
    }

    const nutrition = value as Record<string, unknown>;
    const normalized: Record<string, number> = {};
    for (const field of NUTRITION_FIELDS) {
      if (!(field in nutrition)) {
        continue;
      }
      const numberValue = nutrition[field];
      if (typeof numberValue !== "number" || !Number.isFinite(numberValue) || numberValue < 0) {
        throw new BadRequestException(`meal.nutrition.${field} must be a non-negative number`);
      }
      normalized[field] = numberValue;
    }

    return normalized;
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
      source: serving.source,
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

  private async resolveViewerDietaryProfile(
    authorization?: string,
  ): Promise<ViewerDietaryProfile | null> {
    if (!authorization?.trim()) {
      return null;
    }

    const currentUser = await this.authService.requireUser(authorization);
    const user = await this.userModel
      .findById(currentUser.id)
      .select(
        "dietaryProfile.allergies dietaryProfile.preferredIngredients dietaryProfile.dislikedIngredients",
      )
      .lean()
      .exec();
    const dietaryProfile = (user?.dietaryProfile ?? {}) as Partial<ViewerDietaryProfile>;

    return {
      allergies: this.normalizeViewerAllergies(dietaryProfile.allergies),
      preferredIngredients: this.normalizeIngredientList(
        dietaryProfile.preferredIngredients,
      ),
      dislikedIngredients: this.normalizeIngredientList(
        dietaryProfile.dislikedIngredients,
      ),
    };
  }

  private hasIngredientPreferences(
    profile: ViewerDietaryProfile | null,
  ): profile is ViewerDietaryProfile {
    return Boolean(
      profile &&
        (profile.preferredIngredients.length > 0 || profile.dislikedIngredients.length > 0),
    );
  }

  private sortByIngredientPreferences(
    servings: any[],
    profile: ViewerDietaryProfile,
  ) {
    return servings
      .map((serving, index) => ({
        serving,
        index,
        score: this.ingredientPreferenceSortScore(serving.mealId, profile),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.index - b.index;
      })
      .map(({ serving }) => serving);
  }

  private ingredientPreferenceSortScore(meal: any, profile: ViewerDietaryProfile) {
    const ingredients = this.normalizeIngredientList(meal?.ingredients);
    if (ingredients.length === 0) {
      return 0;
    }

    const preferredMatches = this.countPreferenceMatches(
      ingredients,
      profile.preferredIngredients,
    );
    const dislikedMatches = this.countPreferenceMatches(
      ingredients,
      profile.dislikedIngredients,
    );

    return (
      Math.min(preferredMatches, PREFERRED_INGREDIENT_MATCH_CAP) *
        PREFERRED_INGREDIENT_SORT_BOOST -
      Math.min(dislikedMatches, DISLIKED_INGREDIENT_MATCH_CAP) *
        DISLIKED_INGREDIENT_SORT_PENALTY
    );
  }

  private countPreferenceMatches(
    normalizedIngredients: string[],
    normalizedPreferences: string[],
  ) {
    if (normalizedPreferences.length === 0) {
      return 0;
    }

    return normalizedPreferences.filter((preference) =>
      normalizedIngredients.some((ingredient) =>
        this.ingredientsMatchPreference(ingredient, preference),
      ),
    ).length;
  }

  private ingredientsMatchPreference(ingredient: string, preference: string) {
    if (!ingredient || !preference) {
      return false;
    }
    if (ingredient === preference) {
      return true;
    }
    if (ingredient.includes(preference) || preference.includes(ingredient)) {
      return true;
    }

    const escaped = this.escapeRegExp(preference);
    return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(ingredient);
  }

  private normalizeViewerAllergies(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return [
      ...new Set(
        value.filter(
          (item): item is AllergyCode =>
            typeof item === "string" && ALLERGY_CODES.includes(item as AllergyCode),
        ),
      ),
    ];
  }

  private normalizeIngredientList(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return [
      ...new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => this.normalizeIngredientText(item))
          .filter(Boolean),
      ),
    ];
  }

  private normalizeIngredientText(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  private objectIdFromPopulated(value: any): Types.ObjectId | undefined {
    if (!value) {
      return undefined;
    }
    if (value instanceof Types.ObjectId) {
      return value;
    }
    if (value._id instanceof Types.ObjectId) {
      return value._id;
    }
    if (typeof value === "string" && Types.ObjectId.isValid(value)) {
      return new Types.ObjectId(value);
    }
    if (typeof value._id === "string" && Types.ObjectId.isValid(value._id)) {
      return new Types.ObjectId(value._id);
    }
    return undefined;
  }

  private populatedName(value: any): string | undefined {
    if (!value || value instanceof Types.ObjectId) {
      return undefined;
    }
    return value.name ?? value._id?.toString?.();
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
