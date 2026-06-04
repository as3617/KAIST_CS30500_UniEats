/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { toObjectId } from "../common/object-id";
import { Meal } from "../meals/schemas/meal.schema";
import { Favorite } from "./schemas/favorite.schema";

export interface AddFavoriteBody {
  mealId?: unknown;
}

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<Favorite>,
    @InjectModel(Meal.name)
    private readonly mealModel: Model<Meal>,
  ) {}

  async findByUser(userId: string) {
    const favorites: any[] = await this.favoriteModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate({ path: "mealId", select: "name category imageUrl dietaryLabels allergens" })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return favorites.map((f) => this.toFavoriteResponse(f));
  }

  async add(userId: string, body: AddFavoriteBody) {
    const mealId = typeof body.mealId === "string" ? body.mealId.trim() : null;
    if (!mealId) throw new BadRequestException("mealId is required");

    const _mealId = toObjectId(mealId, "mealId");
    const meal = await this.mealModel
      .findById(_mealId)
      .select("name category imageUrl dietaryLabels allergens")
      .lean()
      .exec();
    if (!meal) throw new NotFoundException("meal not found");

    try {
      const fav = await this.favoriteModel.create({
        userId: new Types.ObjectId(userId),
        mealId: _mealId,
      });
      return this.toFavoriteResponse({
        ...(fav as any).toObject(),
        mealId: meal,
      });
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException("meal already in favorites");
      throw err;
    }
  }

  async remove(userId: string, mealId: string) {
    const _mealId = toObjectId(mealId, "mealId");
    const result = await this.favoriteModel
      .deleteOne({ userId: new Types.ObjectId(userId), mealId: _mealId })
      .exec();
    if (result.deletedCount === 0) throw new NotFoundException("favorite not found");
    return {};
  }

  private toFavoriteResponse(favorite: any) {
    const meal =
      typeof favorite.mealId === "object" && favorite.mealId !== null
        ? favorite.mealId
        : undefined;
    const mealId = meal?._id ? String(meal._id) : String(favorite.mealId);

    return {
      id: String(favorite._id),
      mealId,
      meal: meal
        ? {
            id: mealId,
            name: meal.name,
            category: meal.category,
            imageUrl: meal.imageUrl,
            dietaryLabels: meal.dietaryLabels ?? [],
            allergens: meal.allergens ?? [],
          }
        : undefined,
      createdAt: favorite.createdAt instanceof Date
        ? favorite.createdAt.toISOString()
        : favorite.createdAt,
    };
  }
}
