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
import { PaginatedData } from "../common/api-response";
import {
  ALLERGY_CODES,
  CATEGORY_CODES,
  DIETARY_LABEL_CODES,
  AllergyCode,
  CategoryCode,
  DietaryLabelCode,
  ManagerPermission,
  ManagerRole,
  UserRole,
} from "../common/enums";
import { toObjectId } from "../common/object-id";
import { parsePagination } from "../common/pagination";
import { MenuServing } from "../menu-servings/schemas/menu-serving.schema";
import { Meal } from "./schemas/meal.schema";

const NUTRITION_FIELDS = ["calories", "carbohydrate", "protein", "fat", "sodium"] as const;

export interface MealListQuery {
  q?: string;
  category?: string;
  dietaryLabel?: string;
  page?: string;
  limit?: string;
}

export interface MealWriteBody {
  name?: unknown;
  description?: unknown;
  category?: unknown;
  imageUrl?: unknown;
  ingredients?: unknown;
  allergens?: unknown;
  dietaryLabels?: unknown;
  nutrition?: unknown;
}

@Injectable()
export class MealsService {
  constructor(
    @InjectModel(Meal.name)
    private readonly mealModel: Model<Meal>,
    @InjectModel(CafeteriaManager.name)
    private readonly cafeteriaManagerModel: Model<CafeteriaManager>,
    @InjectModel(MenuServing.name)
    private readonly menuServingModel: Model<MenuServing>,
    private readonly authService: AuthService,
  ) {}

  async findAll(query: MealListQuery): Promise<PaginatedData<Record<string, unknown>>> {
    const { page, limit, skip } = parsePagination(query as Record<string, unknown>);
    const filter = this.buildFilter(query);

    const [items, total] = await Promise.all([
      this.mealModel.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean().exec(),
      this.mealModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((meal) => this.toResponse(meal)),
      page,
      limit,
      total,
    };
  }

  async findById(mealId: string) {
    const _id = toObjectId(mealId, "mealId");
    const meal = await this.mealModel.findById(_id).lean().exec();

    if (!meal) {
      throw new NotFoundException("meal not found");
    }

    return this.toResponse(meal);
  }

  async create(authorization: string | undefined, body?: MealWriteBody) {
    const currentUser = await this.requireMealWriteUser(authorization);
    const meal = await this.mealModel.create({
      ...this.normalizeCreateBody(body),
      createdBy: new Types.ObjectId(currentUser.id),
    });

    return this.toResponse(meal.toObject());
  }

  async update(mealId: string, authorization: string | undefined, body?: MealWriteBody) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    const _id = toObjectId(mealId, "mealId");
    const existingMeal = await this.mealModel.findById(_id).lean().exec();

    if (!existingMeal) {
      throw new NotFoundException("meal not found");
    }

    await this.assertCanUpdateMeal(currentUser, existingMeal);

    const meal = await this.mealModel
      .findByIdAndUpdate(
        _id,
        { $set: this.normalizeUpdateBody(body) },
        { returnDocument: "after", runValidators: true },
      )
      .lean()
      .exec();

    if (!meal) {
      throw new NotFoundException("meal not found");
    }

    return this.toResponse(meal);
  }

  private buildFilter(query: MealListQuery): Record<string, unknown> {
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

    return filter;
  }

  private async requireMealWriteUser(authorization?: string): Promise<AuthenticatedUser> {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });

    if (currentUser.role === UserRole.ADMIN) {
      return currentUser;
    }

    if (currentUser.role !== UserRole.MANAGER) {
      throw new ForbiddenException("manager role required");
    }

    const managedCafeteriaIds = await this.findManagedCafeteriaIds(
      currentUser.id,
      ManagerPermission.MENU_WRITE,
    );
    if (managedCafeteriaIds.length === 0) {
      throw new ForbiddenException("menu write permission required");
    }

    return currentUser;
  }

  private async assertCanUpdateMeal(currentUser: AuthenticatedUser, meal: any) {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role !== UserRole.MANAGER) {
      throw new ForbiddenException("manager role required");
    }

    if (meal.createdBy?.toString?.() === currentUser.id) {
      return;
    }

    const managedCafeteriaIds = await this.findManagedCafeteriaIds(
      currentUser.id,
      ManagerPermission.MENU_WRITE,
    );
    if (managedCafeteriaIds.length === 0) {
      throw new ForbiddenException("menu write permission required");
    }

    const attachedServing = await this.menuServingModel
      .findOne({
        mealId: meal._id,
        cafeteriaId: { $in: managedCafeteriaIds },
      })
      .select("_id")
      .lean()
      .exec();

    if (!attachedServing) {
      throw new ForbiddenException("meal is not manageable by this user");
    }
  }

  private async findManagedCafeteriaIds(
    userId: string,
    permission: ManagerPermission,
  ): Promise<Types.ObjectId[]> {
    const managers = await this.cafeteriaManagerModel
      .find({
        userId: new Types.ObjectId(userId),
        isActive: true,
        $or: [{ managerRole: ManagerRole.OWNER }, { permissions: permission }],
      })
      .select("cafeteriaId")
      .lean()
      .exec();

    return managers.map((manager) => manager.cafeteriaId as Types.ObjectId);
  }

  private normalizeCreateBody(body?: MealWriteBody) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("request body is required");
    }

    return {
      name: this.normalizeRequiredString(body.name, "name", 120),
      description: this.normalizeOptionalString(body.description, "description", 1000),
      category: this.normalizeEnum(body.category, "category", CATEGORY_CODES) as CategoryCode,
      imageUrl: this.normalizeOptionalString(body.imageUrl, "imageUrl", 1000),
      ingredients: this.normalizeStringArray(body.ingredients, "ingredients", false),
      allergens: this.normalizeEnumArray(
        body.allergens,
        "allergens",
        ALLERGY_CODES,
      ) as AllergyCode[],
      dietaryLabels: this.normalizeEnumArray(
        body.dietaryLabels,
        "dietaryLabels",
        DIETARY_LABEL_CODES,
      ) as DietaryLabelCode[],
      nutrition: this.normalizeNutrition(body.nutrition, false),
    };
  }

  private normalizeUpdateBody(body?: MealWriteBody) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("request body is required");
    }

    const update: Record<string, unknown> = {};

    if ("name" in body) {
      update.name = this.normalizeRequiredString(body.name, "name", 120);
    }
    if ("description" in body) {
      update.description = this.normalizeOptionalString(body.description, "description", 1000);
    }
    if ("category" in body) {
      update.category = this.normalizeEnum(body.category, "category", CATEGORY_CODES);
    }
    if ("imageUrl" in body) {
      update.imageUrl = this.normalizeOptionalString(body.imageUrl, "imageUrl", 1000);
    }
    if ("ingredients" in body) {
      update.ingredients = this.normalizeStringArray(body.ingredients, "ingredients", true);
    }
    if ("allergens" in body) {
      update.allergens = this.normalizeEnumArray(body.allergens, "allergens", ALLERGY_CODES);
    }
    if ("dietaryLabels" in body) {
      update.dietaryLabels = this.normalizeEnumArray(
        body.dietaryLabels,
        "dietaryLabels",
        DIETARY_LABEL_CODES,
      );
    }
    if ("nutrition" in body) {
      update.nutrition = this.normalizeNutrition(body.nutrition, true);
    }

    if (Object.keys(update).length === 0) {
      throw new BadRequestException("no updatable fields provided");
    }

    return update;
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

  private normalizeEnum(value: unknown, fieldName: string, allowedValues: string[]) {
    if (typeof value !== "string" || !allowedValues.includes(value)) {
      throw new BadRequestException(`${fieldName} contains invalid value`);
    }
    return value;
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
      throw new BadRequestException("nutrition must be an object");
    }

    const nutrition = value as Record<string, unknown>;
    const normalized: Record<string, number> = {};
    for (const field of NUTRITION_FIELDS) {
      if (!(field in nutrition)) {
        continue;
      }
      const numberValue = nutrition[field];
      if (typeof numberValue !== "number" || !Number.isFinite(numberValue) || numberValue < 0) {
        throw new BadRequestException(`nutrition.${field} must be a non-negative number`);
      }
      normalized[field] = numberValue;
    }

    return normalized;
  }

  private toResponse(meal: any) {
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
}
