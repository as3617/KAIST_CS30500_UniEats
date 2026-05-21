import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";

const ERROR_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: "VALIDATION_ERROR",
  [HttpStatus.UNAUTHORIZED]: "UNAUTHORIZED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.CONFLICT]: "CONFLICT",
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      success: false,
      error: {
        code: ERROR_CODES[status] ?? "INTERNAL_SERVER_ERROR",
        message: this.getMessage(exception, status),
      },
    });
  }

  private getMessage(exception: unknown, status: number): string {
    if (!(exception instanceof HttpException)) {
      return "Internal server error";
    }

    const body = exception.getResponse();
    if (typeof body === "string") {
      return body;
    }

    if (body && typeof body === "object" && "message" in body) {
      const message = (body as { message?: unknown }).message;
      if (Array.isArray(message)) {
        return message.join(", ");
      }
      if (typeof message === "string") {
        return message;
      }
    }

    return status === HttpStatus.INTERNAL_SERVER_ERROR
      ? "Internal server error"
      : exception.message;
  }
}
