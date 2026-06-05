import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ok } from "../common/api-response";
import { DiscountsService, DiscountWriteBody } from "./discounts.service";

@Controller()
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Get("discounts")
  async findAll(@Query("admin") admin?: string, @Headers("authorization") authorization?: string) {
    if (admin === "true") {
      return ok(await this.discountsService.findAllAdmin(authorization));
    }
    return ok(await this.discountsService.findAll());
  }

  @Post("discounts")
  async create(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: DiscountWriteBody,
  ) {
    return ok(await this.discountsService.create(authorization, body), "Discount created");
  }

  @Patch("discounts/:discountId")
  async update(
    @Param("discountId") discountId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: DiscountWriteBody,
  ) {
    return ok(await this.discountsService.update(discountId, authorization, body), "Discount updated");
  }

  @Delete("discounts/:discountId")
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param("discountId") discountId: string,
    @Headers("authorization") authorization: string | undefined,
  ) {
    await this.discountsService.remove(discountId, authorization);
    return ok(null, "Discount deleted");
  }
}
