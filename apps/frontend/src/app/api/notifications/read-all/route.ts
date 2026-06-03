import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { notificationsStore } from "@/mocks/store";
import { errorJson, okJson } from "@/mocks/respond";

export async function PATCH(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const isAuthenticated = (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
  if (!isAuthenticated) return errorJson(401, "UNAUTHORIZED", "sign in required");

  const readAt = new Date().toISOString();
  let updatedCount = 0;
  notificationsStore.forEach((notification) => {
    if (!notification.readAt) {
      notification.readAt = readAt;
      updatedCount += 1;
    }
  });

  return okJson({ updatedCount });
}
