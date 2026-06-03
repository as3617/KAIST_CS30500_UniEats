import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../_utils";
import { notificationsStore } from "@/mocks/store";
import { errorJson, okJson } from "@/mocks/respond";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const isAuthenticated = (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
  if (!isAuthenticated) return errorJson(401, "UNAUTHORIZED", "sign in required");

  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const notifications = [...notificationsStore]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  return okJson(notifications);
}
