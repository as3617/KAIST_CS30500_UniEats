import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../_utils";
import { discountsStore, menuServingsStore } from "@/mocks/store";
import { okJson } from "@/mocks/respond";
import type { Discount } from "@/types";

let nextId = 100;

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const isAdmin = request.nextUrl.searchParams.get("admin") === "true";
  const now = new Date().toISOString();
  const items = isAdmin
    ? [...discountsStore]
    : discountsStore.filter((d) => d.isActive && d.validUntil >= now);
  return okJson(items);
}

export async function POST(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const body = await request.json();
  const discountedPrice = Number(body.discountedPrice);
  const validUntil = body.validUntil ? new Date(body.validUntil) : null;
  if (!Number.isFinite(discountedPrice) || discountedPrice < 0) {
    return new Response(JSON.stringify({ error: "discountedPrice must be a non-negative number" }), { status: 400 });
  }
  if (!validUntil || Number.isNaN(validUntil.getTime())) {
    return new Response(JSON.stringify({ error: "validUntil must be a valid date" }), { status: 400 });
  }
  const menuServing = menuServingsStore.find((serving) => serving.id === body.menuServingId);
  if (!menuServing) {
    return new Response(JSON.stringify({ error: "menu serving not found" }), { status: 404 });
  }
  if (body.cafeteriaId && body.cafeteriaId !== menuServing.cafeteria.id) {
    return new Response(JSON.stringify({ error: "menuServingId does not belong to cafeteriaId" }), { status: 400 });
  }
  const discount: Discount = {
    id: String(nextId++),
    cafeteriaId: menuServing.cafeteria.id,
    cafeteriaName: menuServing.cafeteria.name,
    menuName: menuServing.meal.name,
    discountedPrice,
    menuServingId: menuServing.id,
    validUntil: validUntil.toISOString(),
    isActive: body.isActive !== false,
    createdAt: new Date().toISOString(),
  };
  discountsStore.push(discount);
  return okJson(discount);
}
