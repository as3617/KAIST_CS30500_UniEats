import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../../_utils";
import { menuServingsStore, notificationsStore } from "@/mocks/store";
import { errorJson, okJson } from "@/mocks/respond";
import { MENU_SERVING_STATUSES } from "@/types";
import type { MenuServingStatus } from "@/types";

type RouteParams = { params: { menuServingId: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const serving = menuServingsStore.find((item) => item.id === params.menuServingId);
  if (!serving) return errorJson(404, "NOT_FOUND", "menu serving not found");

  const body = await request.json();
  const status = body.status as MenuServingStatus | undefined;
  if (!status || !MENU_SERVING_STATUSES.includes(status)) {
    return errorJson(400, "VALIDATION_ERROR", "valid status is required");
  }

  const previousStatus = serving.status;
  serving.status = status;
  if (previousStatus !== status && status !== "HIDDEN") {
    const statusLabel = status === "SOLD_OUT" ? "품절" : "판매 가능";
    notificationsStore.unshift({
      id: `noti_menu_status_${Date.now()}`,
      type: "MENU_STATUS_UPDATED",
      title: `${serving.meal.name} 상태가 변경되었습니다.`,
      message: `${serving.cafeteria.name}의 ${serving.meal.name} 메뉴가 ${statusLabel} 상태로 변경되었습니다.`,
      resourceType: "MENU_SERVING",
      resourceId: serving.id,
      readAt: null,
      createdAt: new Date().toISOString(),
    });
  }
  return okJson(serving, "Menu status updated");
}
