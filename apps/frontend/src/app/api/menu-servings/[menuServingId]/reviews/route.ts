import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../../_utils";
import { mockUser } from "@/mocks/data";
import { menuServingsStore, receiptsStore, reviewsStore } from "@/mocks/store";
import { createdJson, errorJson, okJson } from "@/mocks/respond";
import type { PaginatedData, Review } from "@/types";

type RouteParams = { params: { menuServingId: string } };

export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const serving = menuServingsStore.find((s) => s.id === params.menuServingId);
  if (!serving) return errorJson(404, "NOT_FOUND", "menu serving not found");

  const reviews = reviewsStore.filter((r) => r.menuServingId === params.menuServingId);
  const result: PaginatedData<Review> = {
    items: reviews,
    page: 1,
    limit: 20,
    total: reviews.length,
  };
  return okJson(result);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!shouldUseMockApi()) return proxyToBackend(request);

  const isAuthenticated = (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
  if (!isAuthenticated) return errorJson(401, "UNAUTHORIZED", "sign in required");

  const serving = menuServingsStore.find((s) => s.id === params.menuServingId);
  if (!serving) return errorJson(404, "NOT_FOUND", "menu serving not found");

  const existing = reviewsStore.find(
    (r) => r.menuServingId === params.menuServingId && r.userId === mockUser.id,
  );
  if (existing) return errorJson(409, "ALREADY_EXISTS", "you already reviewed this meal");

  const body = await request.json();
  const { receiptId, rating, detailRatings, content } = body;

  if (!receiptId || !rating || !detailRatings) {
    return errorJson(400, "VALIDATION_ERROR", "receiptId, rating, and detailRatings are required");
  }

  const receipt = receiptsStore.find((r) => r.id === receiptId);
  if (!receipt) return errorJson(404, "NOT_FOUND", "receipt not found");
  if (receipt.status !== "VERIFIED") {
    return errorJson(400, "INVALID_STATUS", "receipt must be verified before writing a review");
  }
  if (receipt.confirmedMenuServingId !== params.menuServingId) {
    return errorJson(400, "MISMATCH", "receipt does not match this menu serving");
  }

  const reviewId = `rev_${Date.now()}`;
  const newReview: Review = {
    id: reviewId,
    userId: mockUser.id,
    mealId: serving.meal.id,
    menuServingId: params.menuServingId,
    cafeteriaId: serving.cafeteria.id,
    receiptId,
    isVerified: true,
    rating,
    detailRatings,
    content: content || undefined,
    createdAt: new Date().toISOString(),
  };

  reviewsStore.push(newReview);
  receipt.status = "USED";
  receipt.usedForReview = true;
  receipt.reviewId = reviewId;

  return createdJson(newReview);
}
