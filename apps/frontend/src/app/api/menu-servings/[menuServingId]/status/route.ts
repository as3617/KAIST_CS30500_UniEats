import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../../_utils";
import { menuServingsStore } from "@/mocks/store";
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

  serving.status = status;
  return okJson(serving, "Menu status updated");
}
