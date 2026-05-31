import { Controller, Get, Query } from "@nestjs/common";
import { ok } from "../common/api-response";
import { AnalyticsService } from "./analytics.service";

@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("recommendations/weekly-best")
  async weeklyBest(@Query() query: Record<string, unknown>) {
    return ok(await this.analyticsService.weeklyBest(query));
  }

  @Get("analytics/cafeteria-ranking")
  async cafeteriaRanking(@Query() query: Record<string, unknown>) {
    return ok(await this.analyticsService.cafeteriaRanking(query));
  }
}
