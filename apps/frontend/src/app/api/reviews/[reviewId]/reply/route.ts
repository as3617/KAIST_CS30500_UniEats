import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../../_utils";
import { reviewsStore } from "@/mocks/store";
import { errorJson, okJson } from "@/mocks/respond";

type RouteParams = { params: { reviewId: string } };

export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const review = reviewsStore.find((item) => item.id === params.reviewId);
  if (!review) return errorJson(404, "NOT_FOUND", "review not found");

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (content.length < 2) {
    return errorJson(400, "VALIDATION_ERROR", "reply content is required");
  }

  const now = new Date().toISOString();
  review.managerReply = {
    managerId: review.managerReply?.managerId ?? "mgr_kaimaru",
    content,
    repliedAt: review.managerReply?.repliedAt ?? now,
    updatedAt: review.managerReply ? now : undefined,
  };

  return okJson(review, "Manager reply saved");
}
