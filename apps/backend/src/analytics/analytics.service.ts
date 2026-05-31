/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { parsePositiveInt } from "../common/pagination";
import { MenuServing } from "../menu-servings/schemas/menu-serving.schema";

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(MenuServing.name)
    private readonly menuServingModel: Model<MenuServing>,
  ) {}

  async weeklyBest(query: Record<string, unknown>) {
    const limit = Math.min(parsePositiveInt(query.limit, 5), 20);

    const servings: any[] = await this.menuServingModel
      .find({ verifiedReviewCount: { $gt: 0 } })
      .sort({ averageRating: -1, verifiedReviewCount: -1 })
      .limit(limit * 3)
      .populate({ path: "mealId", select: "name" })
      .populate({ path: "cafeteriaId", select: "name" })
      .lean()
      .exec();

    return servings
      .map((s) => ({
        menuServingId: String(s._id),
        mealName: s.mealId?.name ?? "",
        cafeteriaName: s.cafeteriaId?.name ?? "",
        averageRating: s.averageRating,
        verifiedReviewCount: s.verifiedReviewCount,
        score: Math.round(s.averageRating * Math.log(1 + s.verifiedReviewCount) * 100) / 100,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async cafeteriaRanking(query: Record<string, unknown>) {
    const limit = Math.min(parsePositiveInt(query.limit, 5), 20);

    const result: any[] = await this.menuServingModel.aggregate([
      { $match: { verifiedReviewCount: { $gt: 0 } } },
      {
        $group: {
          _id: "$cafeteriaId",
          averageRating: { $avg: "$averageRating" },
          verifiedReviewCount: { $sum: "$verifiedReviewCount" },
        },
      },
      { $sort: { averageRating: -1, verifiedReviewCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "cafeterias",
          localField: "_id",
          foreignField: "_id",
          as: "cafeteria",
        },
      },
      { $unwind: { path: "$cafeteria", preserveNullAndEmptyArrays: true } },
    ]);

    return result.map((item, index) => ({
      cafeteriaId: String(item._id),
      cafeteriaName: item.cafeteria?.name ?? "",
      averageRating: Math.round(item.averageRating * 10) / 10,
      verifiedReviewCount: item.verifiedReviewCount,
      rank: index + 1,
    }));
  }
}
