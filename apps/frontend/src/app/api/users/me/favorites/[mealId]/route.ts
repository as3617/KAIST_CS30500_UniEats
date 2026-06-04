import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../../../_utils";
import { errorJson, okJson } from "@/mocks/respond";
import { favoritesStore } from "@/mocks/store";

type RouteParams = {
  params: {
    mealId: string;
  };
};

function isAuthorized(request: NextRequest) {
  return (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!shouldUseMockApi()) {
    return proxyToBackend(request);
  }

  if (!isAuthorized(request)) {
    return errorJson(401, "UNAUTHORIZED", "Missing access token");
  }

  const index = favoritesStore.findIndex(
    (favorite) => favorite.mealId === params.mealId,
  );
  if (index === -1) {
    return errorJson(404, "NOT_FOUND", "favorite not found");
  }

  favoritesStore.splice(index, 1);
  return okJson({}, "Removed from favorites");
}
