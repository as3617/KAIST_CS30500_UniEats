/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { PaginatedData } from "../common/api-response";
import { toObjectId } from "../common/object-id";
import { parsePagination } from "../common/pagination";
import { MenuServing } from "../menu-servings/schemas/menu-serving.schema";
import { ViewHistory } from "./schemas/view-history.schema";

@Injectable()
export class ViewHistoriesService {
  constructor(
    @InjectModel(ViewHistory.name)
    private readonly viewHistoryModel: Model<ViewHistory>,
    @InjectModel(MenuServing.name)
    private readonly menuServingModel: Model<MenuServing>,
  ) {}

  async record(userId: string, menuServingId: string) {
    try {
      const servingId = toObjectId(menuServingId, "menuServingId");
      const serving: any = await this.menuServingModel.findById(servingId).lean().exec();
      if (!serving) return;

      await this.viewHistoryModel.create({
        userId: new Types.ObjectId(userId),
        mealId: serving.mealId,
        menuServingId: servingId,
        viewedAt: new Date(),
      });
    } catch {
      // best-effort
    }
  }

  async findByUser(
    userId: string,
    query: Record<string, unknown>,
  ): Promise<PaginatedData<any>> {
    const { page, limit, skip } = parsePagination(query);
    const filter = { userId: new Types.ObjectId(userId) };

    const [items, total] = await Promise.all([
      this.viewHistoryModel
        .find(filter)
        .sort({ viewedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "menuServingId",
          populate: [
            { path: "mealId", select: "name category imageUrl" },
            { path: "cafeteriaId", select: "name" },
          ],
        })
        .lean()
        .exec(),
      this.viewHistoryModel.countDocuments(filter).exec(),
    ]);

    return {
      items: (items as any[]).map((h) => {
        const serving = h.menuServingId;
        const hasFull = serving && typeof serving === "object" && serving._id;
        return {
          id: String(h._id),
          menuServingId: hasFull ? String(serving._id) : String(h.menuServingId),
          mealName: hasFull ? serving.mealId?.name : undefined,
          cafeteriaName: hasFull ? serving.cafeteriaId?.name : undefined,
          viewedAt: h.viewedAt instanceof Date ? h.viewedAt.toISOString() : String(h.viewedAt),
        };
      }),
      page,
      limit,
      total,
    };
  }
}
