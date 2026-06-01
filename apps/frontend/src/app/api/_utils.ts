import type { NextRequest } from "next/server";

const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";

export function shouldUseMockApi() {
  return process.env.NEXT_PUBLIC_USE_MOCK === "true";
}

export async function proxyToBackend(request: NextRequest) {
  const backendPath = request.nextUrl.pathname.replace(/^\/api/, "");
  const targetUrl = `${apiBaseUrl}/api${backendPath}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);

  headers.delete("host");
  headers.delete("content-length");

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const response = await fetch(targetUrl, init);
  const responseHeaders = new Headers(response.headers);

  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
