import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import { ok } from "../common/api-response";
import { MealListQuery, MealWriteBody, MealsService } from "./meals.service";

@Controller("meals")
export class MealsController {
  constructor(private readonly mealsService: MealsService) {}

  @Get()
  async findAll(@Query() query: MealListQuery) {
    return ok(await this.mealsService.findAll(query));
  }

  @Post()
  async create(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: MealWriteBody,
  ) {
    return ok(await this.mealsService.create(authorization, body), "Meal created");
  }

  @Get(":mealId")
  async findById(@Param("mealId") mealId: string) {
    return ok(await this.mealsService.findById(mealId));
  }

  @Patch(":mealId")
  async update(
    @Param("mealId") mealId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: MealWriteBody,
  ) {
    return ok(await this.mealsService.update(mealId, authorization, body));
  }
}
