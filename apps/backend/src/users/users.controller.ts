/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AuthService } from "../auth/auth.service";
import { ok } from "../common/api-response";
import { Cafeteria } from "../cafeterias/schemas/cafeteria.schema";
import { CafeteriaManager } from "../cafeteria-managers/schemas/cafeteria-manager.schema";
import { FavoritesService } from "../favorites/favorites.service";
import { ViewHistoriesService } from "../view-histories/view-histories.service";
import { UpdateMeBody, UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly favoritesService: FavoritesService,
    private readonly viewHistoriesService: ViewHistoriesService,
    @InjectModel(CafeteriaManager.name)
    private readonly cafeteriaManagerModel: Model<CafeteriaManager>,
    @InjectModel(Cafeteria.name)
    private readonly cafeteriaModel: Model<Cafeteria>,
  ) {}

  @Get("me")
  async me(@Headers("authorization") authorization?: string) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    return ok(await this.usersService.findMe(currentUser.id));
  }

  @Patch("me")
  async updateMe(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: UpdateMeBody,
  ) {
    const currentUser = await this.authService.requireUser(authorization, {
      requireEmailVerified: true,
    });
    return ok(await this.usersService.updateMe(currentUser.id, body));
  }

  @Get("me/favorites")
  async getFavorites(@Headers("authorization") authorization: string | undefined) {
    const currentUser = await this.authService.requireUser(authorization);
    return ok(await this.favoritesService.findByUser(currentUser.id));
  }

  @Post("me/favorites")
  async addFavorite(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: any,
  ) {
    const currentUser = await this.authService.requireUser(authorization);
    return ok(await this.favoritesService.add(currentUser.id, body), "Added to favorites");
  }

  @Delete("me/favorites/:mealId")
  async removeFavorite(
    @Headers("authorization") authorization: string | undefined,
    @Param("mealId") mealId: string,
  ) {
    const currentUser = await this.authService.requireUser(authorization);
    return ok(await this.favoritesService.remove(currentUser.id, mealId), "Removed from favorites");
  }

  @Get("me/history")
  async getHistory(
    @Headers("authorization") authorization: string | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    const currentUser = await this.authService.requireUser(authorization);
    return ok(await this.viewHistoriesService.findByUser(currentUser.id, query));
  }

  @Get("me/managed-cafeteria")
  async getManagedCafeteria(@Headers("authorization") authorization: string | undefined) {
    const currentUser = await this.authService.requireUser(authorization);

    const assignment: any = await this.cafeteriaManagerModel
      .findOne({ userId: new Types.ObjectId(currentUser.id), isActive: true })
      .lean()
      .exec();

    if (!assignment) return ok(null);

    const cafeteria: any = await this.cafeteriaModel
      .findById(assignment.cafeteriaId)
      .lean()
      .exec();

    return ok(
      cafeteria
        ? {
            cafeteriaId: String(cafeteria._id),
            name: cafeteria.name,
            permissions: assignment.permissions,
          }
        : null,
    );
  }
}
