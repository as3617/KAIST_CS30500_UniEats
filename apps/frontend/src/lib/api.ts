// Thin fetch wrapper that speaks the team17 API envelope. The frontend always
// calls `/api/*`; Next.js rewrites that path either to the in-app mock route
// handlers (NEXT_PUBLIC_USE_MOCK=true) or to the NestJS backend.

import { authStorage } from "./auth-storage";
import type { ApiResponse } from "@/types";

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  // Skip attaching the Authorization header even if a token is available.
  // Useful for the login and register endpoints.
  anonymous?: boolean;
};

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = normalized.startsWith("/api/") ? normalized : `/api${normalized}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers = {}, query, anonymous, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders["Content-Type"] = finalHeaders["Content-Type"] ?? "application/json";
  }

  if (!anonymous) {
    const token = authStorage.getAccessToken();
    if (token) {
      finalHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    headers: finalHeaders,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });

  // We do not try to recover from non-JSON responses; the contract guarantees
  // a JSON envelope on both success and error paths.
  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      "NETWORK_ERROR",
      `Unexpected non-JSON response (${response.status})`,
      response.status,
    );
  }

  if (!payload.success) {
    throw new ApiClientError(
      payload.error?.code ?? "REQUEST_FAILED",
      payload.error?.message ?? `Request failed (${response.status})`,
      response.status,
    );
  }

  return payload.data;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "body" | "method">) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body" | "method">) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body" | "method">) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "body" | "method">) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};
