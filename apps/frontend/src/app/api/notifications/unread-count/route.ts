import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { notificationsStore } from "@/mocks/store";
import { errorJson, okJson } from "@/mocks/respond";

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const isAuthenticated = (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
  if (!isAuthenticated) return errorJson(401, "UNAUTHORIZED", "sign in required");

  return okJson({
    unreadCount: notificationsStore.filter((notification) => !notification.readAt).length,
  });
}
