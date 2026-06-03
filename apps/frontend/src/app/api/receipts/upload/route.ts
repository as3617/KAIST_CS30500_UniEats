import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { menuServingsStore, notificationsStore, receiptsStore } from "@/mocks/store";
import { createdJson, errorJson } from "@/mocks/respond";
import type { Receipt } from "@/types";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const isAuthenticated = (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
  if (!isAuthenticated) return errorJson(401, "UNAUTHORIZED", "sign in required");

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("image") ?? formData?.get("file");
  if (!(file instanceof File)) {
    return errorJson(400, "VALIDATION_ERROR", "image file is required");
  }
  if (!file.type.startsWith("image/")) {
    return errorJson(400, "VALIDATION_ERROR", "image file must use an image content type");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return errorJson(400, "VALIDATION_ERROR", "image file must be 5MB or smaller");
  }

  // Mock OCR: skip actual image parsing, simulate a recognized receipt
  const receiptId = `rcp_${Date.now()}`;
  const receipt: Receipt = {
    id: receiptId,
    status: "NEED_CONFIRMATION",
    parsed: {
      purchasedAt: new Date().toISOString(),
      cafeteriaName: "Kaimaru",
      mealNames: ["Mackerel Set"],
      totalPrice: 4900,
    },
    matchedMenuServings: menuServingsStore.map((s) => ({
      id: s.id,
      mealName: s.meal.name,
      cafeteriaName: s.cafeteria.name,
      date: s.date,
      price: s.price,
    })),
    usedForReview: false,
  };

  receiptsStore.push(receipt);
  notificationsStore.unshift({
    id: `noti_receipt_status_${Date.now()}`,
    type: "RECEIPT_STATUS_UPDATED",
    title: "영수증 확인이 필요합니다.",
    message: "OCR 처리가 완료되었습니다. 구매한 메뉴를 확인해 주세요.",
    resourceType: "RECEIPT",
    resourceId: receipt.id,
    readAt: null,
    createdAt: new Date().toISOString(),
  });
  return createdJson(receipt);
}
