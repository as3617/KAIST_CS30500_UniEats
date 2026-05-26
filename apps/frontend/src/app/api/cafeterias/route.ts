import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../_utils";
import { mockCafeterias } from "@/mocks/data";
import { okJson } from "@/mocks/respond";

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) {
    return proxyToBackend(request);
  }

  return okJson(mockCafeterias);
}
