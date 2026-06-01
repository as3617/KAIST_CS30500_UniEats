import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { mockUser } from "@/mocks/data";
import { errorJson, okJson } from "@/mocks/respond";
import { isKaistEmail } from "@/lib/validation";
import type { LoginResponse } from "@/types";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  if (!shouldUseMockApi()) {
    return proxyToBackend(request);
  }

  const body = (await request.json().catch(() => null)) as LoginBody | null;

  if (!body?.email || !body.password) {
    return errorJson(400, "VALIDATION_ERROR", "email and password are required");
  }

  if (!isKaistEmail(body.email)) {
    return errorJson(400, "VALIDATION_ERROR", "Only kaist.ac.kr emails are allowed");
  }

  // The mock backend accepts any password of length >= 4 for convenience.
  if (body.password.length < 4) {
    return errorJson(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }

  const localPart = body.email.split("@")[0].toLowerCase();
  const role = localPart.startsWith("admin")
    ? "ADMIN"
    : localPart.startsWith("manager")
      ? "MANAGER"
      : "USER";

  const payload: LoginResponse = {
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    user: {
      id: role === "USER" ? mockUser.id : `u_demo_${role.toLowerCase()}`,
      email: body.email,
      nickname: body.email.split("@")[0],
      role,
      isEmailVerified: true,
    },
  };

  return okJson(payload);
}
