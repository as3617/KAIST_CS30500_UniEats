import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { errorJson, okJson } from "@/mocks/respond";

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) {
    return proxyToBackend(request);
  }

  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return errorJson(400, "VALIDATION_ERROR", "token is required");
  }
  if (token.toLowerCase().includes("expired")) {
    return errorJson(401, "INVALID_TOKEN", "invalid or expired token");
  }

  return okJson({ isEmailVerified: true }, "Email verified");
}
