// Helpers for shaping Route Handler responses to match the team17 API
// envelope. Keeping this in one place ensures every mock endpoint speaks the
// same dialect as the real backend.

import { NextResponse } from "next/server";

export function okJson<T>(data: T, message?: string, init?: ResponseInit) {
  return NextResponse.json(
    { success: true, data, message: message ?? "OK" },
    { status: 200, ...init },
  );
}

export function createdJson<T>(data: T, message?: string) {
  return okJson(data, message, { status: 201 });
}

export function errorJson(
  status: number,
  code: string,
  message: string,
) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
}
