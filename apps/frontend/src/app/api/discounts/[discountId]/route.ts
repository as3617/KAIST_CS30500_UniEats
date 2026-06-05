import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { discountsStore } from "@/mocks/store";
import { okJson } from "@/mocks/respond";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ discountId: string }> },
) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const { discountId } = await params;
  const body = await request.json();
  const idx = discountsStore.findIndex((d) => d.id === discountId);
  if (idx === -1) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });

  discountsStore[idx] = { ...discountsStore[idx], ...body };
  return okJson(discountsStore[idx]);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ discountId: string }> },
) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const { discountId } = await params;
  const idx = discountsStore.findIndex((d) => d.id === discountId);
  if (idx === -1) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });

  discountsStore.splice(idx, 1);
  return okJson(null);
}
