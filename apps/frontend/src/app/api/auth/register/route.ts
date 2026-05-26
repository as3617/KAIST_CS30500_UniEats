import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { createdJson, errorJson } from "@/mocks/respond";
import { isKaistEmail, isStrongEnoughPassword } from "@/lib/validation";

type RegisterBody = {
  email?: string;
  password?: string;
  nickname?: string;
};

export async function POST(request: NextRequest) {
  if (!shouldUseMockApi()) {
    return proxyToBackend(request);
  }

  const body = (await request.json().catch(() => null)) as RegisterBody | null;

  if (!body?.email || !body.password || !body.nickname) {
    return errorJson(
      400,
      "VALIDATION_ERROR",
      "email, password and nickname are required",
    );
  }

  if (!isKaistEmail(body.email)) {
    return errorJson(400, "VALIDATION_ERROR", "Only kaist.ac.kr emails are allowed");
  }

  if (!isStrongEnoughPassword(body.password)) {
    return errorJson(
      400,
      "VALIDATION_ERROR",
      "Password must be at least 8 characters long",
    );
  }

  return createdJson(
    {
      userId: `u_${Date.now()}`,
      email: body.email,
      isEmailVerified: false,
    },
    "Verification email sent",
  );
}
