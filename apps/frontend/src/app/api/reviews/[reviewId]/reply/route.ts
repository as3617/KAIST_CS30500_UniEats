import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../../_utils";
import { notificationsStore, reviewsStore } from "@/mocks/store";
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
  const hadReply = Boolean(review.managerReply);
  review.managerReply = {
    managerId: review.managerReply?.managerId ?? "mgr_kaimaru",
    content,
    repliedAt: review.managerReply?.repliedAt ?? now,
    updatedAt: hadReply ? now : undefined,
  };

  if (!hadReply) {
    notificationsStore.unshift({
      id: `noti_manager_reply_${Date.now()}`,
      type: "MANAGER_REPLY",
      title: "리뷰에 답변이 등록되었습니다.",
      message: "작성하신 리뷰에 식당 매니저 답변이 등록되었습니다.",
      resourceType: "REVIEW",
      resourceId: review.id,
      readAt: null,
      createdAt: now,
    });
  }

  return okJson(review, "Manager reply saved");
}
