import { Body, Controller, Get, Headers, Patch } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { ok } from "../common/api-response";
import { UpdateMeBody, UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
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
}
