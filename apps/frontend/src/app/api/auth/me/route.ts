import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { mockUser } from "@/mocks/data";
import { errorJson, okJson } from "@/mocks/respond";

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) {
    return proxyToBackend(request);
  }

  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return errorJson(401, "UNAUTHORIZED", "Missing access token");
  }

  return okJson({
    id: mockUser.id,
    email: mockUser.email,
    nickname: mockUser.nickname,
    role: mockUser.role,
    isEmailVerified: mockUser.isEmailVerified,
  });
}
