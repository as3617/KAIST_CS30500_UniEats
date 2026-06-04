import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../../_utils";
import { notificationsStore } from "@/mocks/store";
import { errorJson, okJson } from "@/mocks/respond";

type RouteParams = { params: { notificationId: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const isAuthenticated = (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
  if (!isAuthenticated) return errorJson(401, "UNAUTHORIZED", "sign in required");

  const notification = notificationsStore.find(
    (item) => item.id === params.notificationId,
  );
  if (!notification) return errorJson(404, "NOT_FOUND", "Notification not found");

  notification.readAt ??= new Date().toISOString();
  return okJson(notification);
}
