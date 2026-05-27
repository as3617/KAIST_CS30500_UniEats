import { Controller, Get, Headers, Param, Query } from "@nestjs/common";
import { ok } from "../common/api-response";
import { MenuServingListQuery, MenuServingsService } from "./menu-servings.service";

@Controller("menu-servings")
export class MenuServingsController {
  constructor(private readonly menuServingsService: MenuServingsService) {}

  @Get()
  async findAll(
    @Query() query: MenuServingListQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return ok(await this.menuServingsService.findAll(query, authorization));
  }

  @Get(":menuServingId")
  async findById(
    @Param("menuServingId") menuServingId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return ok(await this.menuServingsService.findById(menuServingId, authorization));
  }
}
