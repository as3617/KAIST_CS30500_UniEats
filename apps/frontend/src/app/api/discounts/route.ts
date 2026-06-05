import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../_utils";
import { authStorage } from "@/lib/auth-storage";
import { discountsStore } from "@/mocks/store";
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
  const discount: Discount = {
    id: String(nextId++),
    cafeteriaName: body.cafeteriaName ?? "",
    menuName: body.menuName ?? "",
    discountedPrice: Number(body.discountedPrice ?? 0),
    validUntil: body.validUntil ?? new Date().toISOString(),
    isActive: body.isActive !== false,
    createdAt: new Date().toISOString(),
  };
  discountsStore.push(discount);
  return okJson(discount);
}
