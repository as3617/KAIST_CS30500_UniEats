import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export enum AuthEmailDeliveryMode {
  LOCAL_FALLBACK = "LOCAL_FALLBACK",
  EMAIL_SERVER_CONFIGURED = "EMAIL_SERVER_CONFIGURED",
}

export type AuthEmailDeliveryResult = {
  mode: AuthEmailDeliveryMode;
  sent: boolean;
};

export type AuthEmailLinkKind = "verify-email" | "reset-password";

@Injectable()
export class AuthEmailService {
  constructor(private readonly configService: ConfigService) {}

  isEmailServerConfigured() {
    return Boolean(
      this.configService.get<string>("SMTP_HOST")?.trim() &&
        this.configService.get<string>("SMTP_FROM")?.trim(),
    );
  }

  buildAuthLink(kind: AuthEmailLinkKind, token: string, email?: string) {
    const baseUrl = this.configService.get<string>("APP_PUBLIC_URL", "http://localhost");
    const path = kind === "verify-email" ? "/verify-email" : "/reset-password";
    const url = new URL(path, baseUrl);
    url.searchParams.set("token", token);
    if (email) {
      url.searchParams.set("email", email);
    }
    return url.toString();
  }

  async sendVerificationEmail(
    email: string,
    verificationLink: string,
  ): Promise<AuthEmailDeliveryResult> {
    return this.sendAuthEmail(email, "UniEats email verification", verificationLink);
  }

  async sendPasswordResetEmail(
    email: string,
    resetLink: string,
  ): Promise<AuthEmailDeliveryResult> {
    return this.sendAuthEmail(email, "UniEats password reset", resetLink);
  }

  private async sendAuthEmail(
    email: string,
    subject: string,
    link: string,
  ): Promise<AuthEmailDeliveryResult> {
    if (!this.isEmailServerConfigured()) {
      return { mode: AuthEmailDeliveryMode.LOCAL_FALLBACK, sent: false };
    }

    // SMTP delivery is intentionally isolated here so a real adapter can replace
    // this placeholder without touching auth token or password-reset logic.
    console.info(
      JSON.stringify({
        event: "auth_email_delivery_pending",
        to: email,
        subject,
        link,
      }),
    );
    return { mode: AuthEmailDeliveryMode.EMAIL_SERVER_CONFIGURED, sent: false };
  }
}
