import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../../_utils";
import { errorJson, okJson } from "@/mocks/respond";
import { isStrongEnoughPassword } from "@/lib/validation";

type PasswordResetConfirmBody = {
  token?: string;
  newPassword?: string;
};

export async function POST(request: NextRequest) {
  if (!shouldUseMockApi()) {
    return proxyToBackend(request);
  }

  const body = (await request.json().catch(() => null)) as PasswordResetConfirmBody | null;

  if (!body?.token) {
    return errorJson(400, "VALIDATION_ERROR", "token is required");
  }
  if (!body.newPassword || !isStrongEnoughPassword(body.newPassword)) {
    return errorJson(
      400,
      "VALIDATION_ERROR",
      "Password must be at least 8 characters long",
    );
  }
  if (body.token.toLowerCase().includes("expired")) {
    return errorJson(401, "INVALID_TOKEN", "invalid or expired token");
  }

  return okJson({ passwordReset: true }, "Password reset");
}
