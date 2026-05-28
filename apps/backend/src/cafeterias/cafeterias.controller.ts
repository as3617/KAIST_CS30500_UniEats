import { Body, Controller, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { ok } from "../common/api-response";
import {
  AssignCafeteriaManagerBody,
  CafeteriaCreateBody,
  CafeteriasService,
  UpdateCafeteriaManagerBody,
} from "./cafeterias.service";

@Controller("cafeterias")
export class CafeteriasController {
  constructor(private readonly cafeteriasService: CafeteriasService) {}

  @Get()
  async findAll() {
    return ok(await this.cafeteriasService.findAll());
  }

  @Post()
  async create(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: CafeteriaCreateBody,
  ) {
    return ok(await this.cafeteriasService.create(authorization, body), "Cafeteria created");
  }

  @Get(":cafeteriaId/managers")
  async findManagers(
    @Param("cafeteriaId") cafeteriaId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return ok(await this.cafeteriasService.findManagers(cafeteriaId, authorization));
  }

  @Post(":cafeteriaId/managers")
  async assignManager(
    @Param("cafeteriaId") cafeteriaId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: AssignCafeteriaManagerBody,
  ) {
    return ok(
      await this.cafeteriasService.assignManager(cafeteriaId, authorization, body),
      "Cafeteria manager assigned",
    );
  }

  @Patch(":cafeteriaId/managers/:userId")
  async updateManager(
    @Param("cafeteriaId") cafeteriaId: string,
    @Param("userId") userId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: UpdateCafeteriaManagerBody,
  ) {
    return ok(await this.cafeteriasService.updateManager(cafeteriaId, userId, authorization, body));
  }

  @Get(":cafeteriaId")
  async findById(@Param("cafeteriaId") cafeteriaId: string) {
    return ok(await this.cafeteriasService.findById(cafeteriaId));
  }
}
