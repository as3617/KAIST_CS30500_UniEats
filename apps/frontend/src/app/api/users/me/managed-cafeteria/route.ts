import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../../_utils";
import { mockCafeterias } from "@/mocks/data";
import { errorJson, okJson } from "@/mocks/respond";

function isAuthorized(request: NextRequest) {
  return (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
}

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) {
    return proxyToBackend(request);
  }

  if (!isAuthorized(request)) {
    return errorJson(401, "UNAUTHORIZED", "Missing access token");
  }

  const cafeteria = mockCafeterias[0];
  return okJson(
    cafeteria
      ? {
          cafeteriaId: cafeteria.id,
          name: cafeteria.name,
          permissions: ["MENU_WRITE", "STATUS_WRITE", "REVIEW_REPLY"],
        }
      : null,
  );
}
