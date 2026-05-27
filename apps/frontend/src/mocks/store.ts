// Mutable in-process state for the mock API. Uses globalThis to survive
// Next.js hot-module reloads in development without losing added entries.

import type { Receipt, Review } from "@/types";
import { mockReceipts, mockReviews } from "./data";

declare global {
  // eslint-disable-next-line no-var
  var __receiptsStore: Receipt[] | undefined;
  // eslint-disable-next-line no-var
  var __reviewsStore: Review[] | undefined;
}

globalThis.__receiptsStore ??= [...mockReceipts];
globalThis.__reviewsStore ??= [...mockReviews];

export const receiptsStore: Receipt[] = globalThis.__receiptsStore;
export const reviewsStore: Review[] = globalThis.__reviewsStore;
