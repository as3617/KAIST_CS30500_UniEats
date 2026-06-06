import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { discountsStore, menuServingsStore } from "@/mocks/store";
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

  const nextDiscount = { ...discountsStore[idx] };
  if (body.discountedPrice !== undefined) {
    nextDiscount.discountedPrice = Number(body.discountedPrice);
  }
  if (body.validUntil !== undefined) {
    nextDiscount.validUntil = body.validUntil;
  }
  if (body.isActive !== undefined) {
    nextDiscount.isActive = body.isActive === true;
  }
  if (body.menuServingId !== undefined) {
    const menuServing = menuServingsStore.find((serving) => serving.id === body.menuServingId);
    if (!menuServing) {
      return new Response(JSON.stringify({ error: "menu serving not found" }), { status: 404 });
    }
    if (body.cafeteriaId && body.cafeteriaId !== menuServing.cafeteria.id) {
      return new Response(JSON.stringify({ error: "menuServingId does not belong to cafeteriaId" }), { status: 400 });
    }
    nextDiscount.cafeteriaId = menuServing.cafeteria.id;
    nextDiscount.cafeteriaName = menuServing.cafeteria.name;
    nextDiscount.menuName = menuServing.meal.name;
    nextDiscount.menuServingId = menuServing.id;
  }

  discountsStore[idx] = nextDiscount;
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
