import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { receiptsStore } from "@/mocks/store";
import { errorJson, okJson } from "@/mocks/respond";

type RouteParams = { params: { receiptId: string } };

export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const receipt = receiptsStore.find((r) => r.id === params.receiptId);
  if (!receipt) return errorJson(404, "NOT_FOUND", "receipt not found");

  return okJson(receipt);
}
