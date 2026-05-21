import { Controller, Get, Param, Query } from "@nestjs/common";
import { ok } from "../common/api-response";
import { MealListQuery, MealsService } from "./meals.service";

@Controller("meals")
export class MealsController {
  constructor(private readonly mealsService: MealsService) {}

  @Get()
  async findAll(@Query() query: MealListQuery) {
    return ok(await this.mealsService.findAll(query));
  }

  @Get(":mealId")
  async findById(@Param("mealId") mealId: string) {
    return ok(await this.mealsService.findById(mealId));
  }
}
