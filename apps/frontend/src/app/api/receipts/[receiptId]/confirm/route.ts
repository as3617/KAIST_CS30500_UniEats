import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../../_utils";
import { notificationsStore, receiptsStore } from "@/mocks/store";
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
  const now = new Date().toISOString();
  notificationsStore.unshift(
    {
      id: `noti_receipt_verified_${Date.now()}`,
      type: "RECEIPT_STATUS_UPDATED",
      title: "영수증이 확인되었습니다.",
      message: "영수증 확인이 완료되었습니다.",
      resourceType: "RECEIPT",
      resourceId: receipt.id,
      readAt: null,
      createdAt: now,
    },
    {
      id: `noti_review_available_${Date.now()}`,
      type: "REVIEW_AVAILABLE",
      title: "리뷰를 작성할 수 있습니다.",
      message: "영수증이 확인되어 리뷰 작성이 가능해졌습니다.",
      resourceType: "RECEIPT",
      resourceId: receipt.id,
      readAt: null,
      createdAt: now,
    },
  );

  return okJson(receipt);
}
