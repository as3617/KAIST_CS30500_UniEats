import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { PaginatedData } from "../common/api-response";
import { toObjectId } from "../common/object-id";
import { parsePagination } from "../common/pagination";
import { Meal } from "./schemas/meal.schema";

export interface MealListQuery {
  q?: string;
  category?: string;
  dietaryLabel?: string;
  page?: string;
  limit?: string;
}

@Injectable()
export class MealsService {
  constructor(
    @InjectModel(Meal.name)
    private readonly mealModel: Model<Meal>,
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
