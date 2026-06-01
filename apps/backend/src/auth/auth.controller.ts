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
  PasswordResetConfirmBody,
  PasswordResetRequestBody,
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
  async verifyEmail(@Query("token") token?: string, @Query("email") email?: string) {
    return ok(await this.authService.verifyEmail(token, email), "Email verified");
  }

  @Post("password-reset/request")
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() body: PasswordResetRequestBody) {
    return ok(
      await this.authService.requestPasswordReset(body),
      "Password reset instructions processed",
    );
  }

  @Post("password-reset/confirm")
  @HttpCode(HttpStatus.OK)
  async confirmPasswordReset(@Body() body: PasswordResetConfirmBody) {
    return ok(await this.authService.confirmPasswordReset(body), "Password reset");
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
