import type { NextRequest } from "next/server";

import { proxyToBackend, shouldUseMockApi } from "../../_utils";
import { mockUser } from "@/mocks/data";
import { errorJson, okJson } from "@/mocks/respond";
import {
  ALLERGY_CODES,
  DIETARY_LABEL_CODES,
} from "@/types";
import type { AllergyCode, DietaryLabelCode, UserProfile } from "@/types";

type UpdateProfileBody = {
  nickname?: unknown;
  dietaryProfile?: unknown;
};

function isAuthorized(request: NextRequest) {
  return (request.headers.get("authorization") ?? "")
    .toLowerCase()
    .startsWith("bearer ");
}

function profileResponse(): UserProfile {
  return {
    id: mockUser.id,
    email: mockUser.email,
    nickname: mockUser.nickname,
    role: mockUser.role,
    dietaryProfile: mockUser.dietaryProfile,
    reviewStats: mockUser.reviewStats,
  };
}

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) {
    return proxyToBackend(request);
  }

  if (!isAuthorized(request)) {
    return errorJson(401, "UNAUTHORIZED", "Missing access token");
  }

  return okJson(profileResponse());
}

export async function PATCH(request: NextRequest) {
  if (!shouldUseMockApi()) {
    return proxyToBackend(request);
  }

  if (!isAuthorized(request)) {
    return errorJson(401, "UNAUTHORIZED", "Missing access token");
  }

  const body = (await request.json().catch(() => null)) as UpdateProfileBody | null;
  if (!body || typeof body !== "object") {
    return errorJson(400, "VALIDATION_ERROR", "request body is required");
  }

  if (typeof body.nickname !== "string") {
    return errorJson(400, "VALIDATION_ERROR", "nickname must be a string");
  }

  const nickname = body.nickname.trim();
  if (nickname.length < 2 || nickname.length > 24) {
    return errorJson(
      400,
      "VALIDATION_ERROR",
      "nickname must be between 2 and 24 characters",
    );
  }

  const dietaryProfile = body.dietaryProfile as Record<string, unknown> | undefined;
  if (!dietaryProfile || typeof dietaryProfile !== "object") {
    return errorJson(400, "VALIDATION_ERROR", "dietaryProfile must be an object");
  }

  const allergies = normalizeEnumArray(
    dietaryProfile.allergies,
    ALLERGY_CODES,
  ) as AllergyCode[] | null;
  const dietaryLabels = normalizeEnumArray(
    dietaryProfile.dietaryLabels,
    DIETARY_LABEL_CODES,
  ) as DietaryLabelCode[] | null;
  const preferredIngredients = normalizeIngredients(dietaryProfile.preferredIngredients);
  const dislikedIngredients = normalizeIngredients(dietaryProfile.dislikedIngredients);

  if (!allergies || !dietaryLabels || !preferredIngredients || !dislikedIngredients) {
    return errorJson(400, "VALIDATION_ERROR", "invalid dietary profile values");
  }

  mockUser.nickname = nickname;
  mockUser.dietaryProfile = {
    allergies,
    dietaryLabels,
    preferredIngredients,
    dislikedIngredients,
  };

  return okJson(profileResponse());
}

function normalizeEnumArray(
  value: unknown,
  acceptedValues: readonly string[],
): string[] | null {
  if (!Array.isArray(value)) return null;

  const accepted = new Set(acceptedValues);
  if (value.some((item) => typeof item !== "string" || !accepted.has(item))) {
    return null;
  }

  return [...new Set(value as string[])];
}

function normalizeIngredients(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > 50) return null;

  const ingredients: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim();
    if (trimmed.length > 64) return null;
    if (trimmed && !ingredients.includes(trimmed)) {
      ingredients.push(trimmed);
    }
  }
  return ingredients;
}
