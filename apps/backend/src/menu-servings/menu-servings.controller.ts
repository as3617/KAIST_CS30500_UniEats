import { Controller, Get, Param, Query } from "@nestjs/common";
import { ok } from "../common/api-response";
import { MenuServingListQuery, MenuServingsService } from "./menu-servings.service";

@Controller("menu-servings")
export class MenuServingsController {
  constructor(private readonly menuServingsService: MenuServingsService) {}

  @Get()
  async findAll(@Query() query: MenuServingListQuery) {
    return ok(await this.menuServingsService.findAll(query));
  }

  @Get(":menuServingId")
  async findById(@Param("menuServingId") menuServingId: string) {
    return ok(await this.menuServingsService.findById(menuServingId));
  }
}
