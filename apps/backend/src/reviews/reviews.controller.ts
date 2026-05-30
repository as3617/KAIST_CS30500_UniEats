import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ok } from "../common/api-response";
import {
  ReviewCreateBody,
  ReviewListQuery,
  ReviewReplyBody,
  ReviewsService,
} from "./reviews.service";

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get("menu-servings/:menuServingId/reviews")
  async findByMenuServing(
    @Param("menuServingId") menuServingId: string,
    @Query() query: ReviewListQuery,
  ) {
    return ok(await this.reviewsService.findByMenuServing(menuServingId, query));
  }

  @Post("menu-servings/:menuServingId/reviews")
  async create(
    @Param("menuServingId") menuServingId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: ReviewCreateBody,
  ) {
    return ok(
      await this.reviewsService.create(menuServingId, authorization, body),
      "Review created",
    );
  }

  @Get("users/me/reviews")
  async findMine(
    @Headers("authorization") authorization: string | undefined,
    @Query() query: ReviewListQuery,
  ) {
    return ok(await this.reviewsService.findMine(authorization, query));
  }

  @Delete("reviews/:reviewId")
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param("reviewId") reviewId: string,
    @Headers("authorization") authorization: string | undefined,
  ) {
    return ok(await this.reviewsService.delete(reviewId, authorization), "Review deleted");
  }

  @Post("reviews/:reviewId/reply")
  @HttpCode(HttpStatus.OK)
  async reply(
    @Param("reviewId") reviewId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: ReviewReplyBody,
  ) {
    return ok(await this.reviewsService.reply(reviewId, authorization, body));
  }
}
