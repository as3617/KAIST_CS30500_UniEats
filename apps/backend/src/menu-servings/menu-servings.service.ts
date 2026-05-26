import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { PaginatedData } from "../common/api-response";
import { toObjectId } from "../common/object-id";
import { parsePagination } from "../common/pagination";
import { AuthService } from "../auth/auth.service";
import { Cafeteria } from "../cafeterias/schemas/cafeteria.schema";
import { Meal } from "../meals/schemas/meal.schema";
import { AllergyCode, MenuServingStatus } from "../common/enums";
import { User } from "../users/schemas/user.schema";
import { MenuServing } from "./schemas/menu-serving.schema";

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
    private readonly authService: AuthService,
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
}
