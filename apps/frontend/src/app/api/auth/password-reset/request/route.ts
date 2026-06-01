import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../../_utils";
import { errorJson, okJson } from "@/mocks/respond";
import { isKaistEmail } from "@/lib/validation";

const MOCK_RESET_PASSWORD = "UnieatsReset123!";

type PasswordResetRequestBody = {
  email?: string;
};

export async function POST(request: NextRequest) {
  if (!shouldUseMockApi()) {
    return proxyToBackend(request);
  }

  const body = (await request.json().catch(() => null)) as PasswordResetRequestBody | null;
  const email = body?.email?.trim().toLowerCase();

  if (!email) {
    return errorJson(400, "VALIDATION_ERROR", "email is required");
  }
  if (!isKaistEmail(email)) {
    return errorJson(400, "VALIDATION_ERROR", "Only kaist.ac.kr emails are allowed");
  }

  return okJson(
    {
      resetRequested: true,
      emailDelivery: { mode: "LOCAL_FALLBACK", sent: false },
      localPasswordReset: { password: MOCK_RESET_PASSWORD },
    },
    "Password reset instructions processed",
  );
}
