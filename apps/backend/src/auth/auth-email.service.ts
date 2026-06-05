import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, Transporter } from "nodemailer";

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
  private transporter?: Transporter;

  constructor(private readonly configService: ConfigService) {}

  isEmailServerConfigured() {
    return Boolean(
      this.configService.get<string>("SMTP_HOST")?.trim() &&
        this.configService.get<string>("SMTP_USER")?.trim() &&
        this.configService.get<string>("SMTP_PASS")?.trim() &&
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

    try {
      await this.getTransporter().sendMail({
        from: this.configService.get<string>("SMTP_FROM")!.trim(),
        to: email,
        subject,
        text: this.buildPlainTextBody(subject, link),
        html: this.buildHtmlBody(subject, link),
      });

      return { mode: AuthEmailDeliveryMode.EMAIL_SERVER_CONFIGURED, sent: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "SMTP send failed";
      console.error(
        JSON.stringify({
          event: "auth_email_delivery_failed",
          to: email,
          subject,
          error: message,
        }),
      );
      return {
        mode: AuthEmailDeliveryMode.EMAIL_SERVER_CONFIGURED,
        sent: false,
      };
    }
  }

  private getTransporter() {
    if (!this.transporter) {
      const secure =
        this.configService.get<string>("SMTP_SECURE", "false").trim().toLowerCase() ===
        "true";
      const parsedPort = Number.parseInt(
        this.configService.get<string>("SMTP_PORT", "587"),
        10,
      );
      const port = Number.isFinite(parsedPort) ? parsedPort : 587;

      this.transporter = createTransport({
        host: this.configService.get<string>("SMTP_HOST")!.trim(),
        port,
        secure,
        requireTLS: !secure,
        auth: {
          user: this.configService.get<string>("SMTP_USER")!.trim(),
          pass: this.configService.get<string>("SMTP_PASS")!,
        },
      });
    }

    return this.transporter;
  }

  private buildPlainTextBody(subject: string, link: string) {
    return [
      subject,
      "",
      "Open the link below to continue:",
      link,
      "",
      "If you did not request this email, you can ignore it.",
    ].join("\n");
  }

  private buildHtmlBody(subject: string, link: string) {
    const escapedSubject = this.escapeHtml(subject);
    const escapedLink = this.escapeHtml(link);

    return [
      `<p>${escapedSubject}</p>`,
      `<p><a href="${escapedLink}">Continue to UniEats</a></p>`,
      `<p>If the button does not work, copy and paste this URL:</p>`,
      `<p>${escapedLink}</p>`,
      `<p>If you did not request this email, you can ignore it.</p>`,
    ].join("");
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}
