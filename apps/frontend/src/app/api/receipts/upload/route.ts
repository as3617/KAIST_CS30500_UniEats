import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { menuServingsStore, receiptsStore } from "@/mocks/store";
import { createdJson, errorJson } from "@/mocks/respond";
import type { Receipt } from "@/types";

export async function POST(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const isAuthenticated = (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
  if (!isAuthenticated) return errorJson(401, "UNAUTHORIZED", "sign in required");

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
  return createdJson(receipt);
}
