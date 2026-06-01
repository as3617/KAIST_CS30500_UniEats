import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Query, Sse } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { ok } from "../common/api-response";
import { ViewHistoriesService } from "../view-histories/view-histories.service";
import { MenuServingEventsService } from "./menu-serving-events.service";
import {
  MenuServingCreateBody,
  MenuServingListQuery,
  MenuServingStatusBody,
  MenuServingsService,
} from "./menu-servings.service";

@Controller("menu-servings")
export class MenuServingsController {
  constructor(
    private readonly menuServingsService: MenuServingsService,
    private readonly menuServingEventsService: MenuServingEventsService,
    private readonly authService: AuthService,
    private readonly viewHistoriesService: ViewHistoriesService,
  ) {}

  @Get()
  async findAll(
    @Query() query: MenuServingListQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return ok(await this.menuServingsService.findAll(query, authorization));
  }

  @Sse("events")
  streamStatusUpdates() {
    return this.menuServingEventsService.stream();
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

  @Post(":menuServingId/view")
  @HttpCode(HttpStatus.OK)
  async recordView(
    @Param("menuServingId") menuServingId: string,
    @Headers("authorization") authorization?: string,
  ) {
    if (authorization) {
      try {
        const user = await this.authService.requireUser(authorization);
        await this.viewHistoriesService.record(user.id, menuServingId);
      } catch {
        // best-effort: view recording must not block response
      }
    }
    return ok({});
  }
}
