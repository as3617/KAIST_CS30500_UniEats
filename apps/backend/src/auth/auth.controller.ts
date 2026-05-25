import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from "@nestjs/common";
import { ok } from "../common/api-response";
import {
  AuthService,
  LoginBody,
  RefreshBody,
  RegisterBody,
  TokenBody,
} from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: RegisterBody) {
    return ok(await this.authService.register(body), "Verification email sent");
  }

  @Get("verify-email")
  async verifyEmail(@Query("token") token?: string) {
    return ok(await this.authService.verifyEmail(token), "Email verified");
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginBody) {
    return ok(await this.authService.login(body));
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshBody) {
    return ok(await this.authService.refresh(body));
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: TokenBody) {
    return ok(await this.authService.logout(body));
  }

  @Get("me")
  async me(@Headers("authorization") authorization?: string) {
    return ok(await this.authService.getMe(authorization));
  }
}
