import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import { ok } from "../common/api-response";
import {
  MenuServingCreateBody,
  MenuServingListQuery,
  MenuServingStatusBody,
  MenuServingsService,
} from "./menu-servings.service";

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

  @Post()
  async create(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: MenuServingCreateBody,
  ) {
    return ok(await this.menuServingsService.create(authorization, body), "Menu serving created");
  }

  @Get(":menuServingId")
  async findById(
    @Param("menuServingId") menuServingId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return ok(await this.menuServingsService.findById(menuServingId, authorization));
  }

  @Patch(":menuServingId/status")
  async updateStatus(
    @Param("menuServingId") menuServingId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: MenuServingStatusBody,
  ) {
    return ok(await this.menuServingsService.updateStatus(menuServingId, authorization, body));
  }
}
