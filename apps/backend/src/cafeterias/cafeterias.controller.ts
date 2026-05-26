import { Controller, Get, Param } from "@nestjs/common";
import { ok } from "../common/api-response";
import { CafeteriasService } from "./cafeterias.service";

@Controller("cafeterias")
export class CafeteriasController {
  constructor(private readonly cafeteriasService: CafeteriasService) {}

  @Get()
  async findAll() {
    return ok(await this.cafeteriasService.findAll());
  }

  @Get(":cafeteriaId")
  async findById(@Param("cafeteriaId") cafeteriaId: string) {
    return ok(await this.cafeteriasService.findById(cafeteriaId));
  }
}
