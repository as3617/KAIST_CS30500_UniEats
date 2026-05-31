import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../../_utils";
import { receiptsStore } from "@/mocks/store";
import { errorJson, okJson } from "@/mocks/respond";

type RouteParams = { params: { receiptId: string } };

export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const isAuthenticated = (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
  if (!isAuthenticated) return errorJson(401, "UNAUTHORIZED", "sign in required");

  const receipt = receiptsStore.find((r) => r.id === params.receiptId);
  if (!receipt) return errorJson(404, "NOT_FOUND", "receipt not found");
  if (receipt.status !== "NEED_CONFIRMATION") {
    return errorJson(400, "INVALID_STATUS", "receipt is not pending confirmation");
  }

  const body = await request.json();
  const { confirmedMenuServingId, menuServingId } = body as {
    confirmedMenuServingId?: string;
    menuServingId?: string;
  };
  const selectedMenuServingId = confirmedMenuServingId ?? menuServingId;
  if (!selectedMenuServingId) {
    return errorJson(400, "VALIDATION_ERROR", "confirmedMenuServingId is required");
  }

  receipt.status = "VERIFIED";
  receipt.confirmedMenuServingId = selectedMenuServingId;

  return okJson(receipt);
}
