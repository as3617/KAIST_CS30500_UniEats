import type { NextRequest } from "next/server";

import { proxyStreamToBackend, shouldUseMockApi } from "../../_utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!shouldUseMockApi()) {
    return proxyStreamToBackend(request);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({
            connectedAt: new Date().toISOString(),
          })}\n\n`,
        ),
      );

      const heartbeat = setInterval(() => {
        controller.enqueue(
          encoder.encode(
            `event: heartbeat\ndata: ${JSON.stringify({
              at: new Date().toISOString(),
            })}\n\n`,
          ),
        );
      }, 30_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream",
    },
  });
}
