"use client";

import { useEffect } from "react";
import type { MenuServingStatus } from "@/types";

export type MenuServingStatusUpdate = {
  menuServingId: string;
  status: MenuServingStatus;
  updatedAt: string;
};

type MenuServingStatusTarget = {
  id: string;
  status: MenuServingStatus;
};

export function useMenuServingStatusEvents(
  onStatusUpdate: (event: MenuServingStatusUpdate) => void,
) {
  useEffect(() => {
    const source = new EventSource("/api/menu-servings/events");

    function handleStatusUpdate(event: Event) {
      try {
        const data = JSON.parse((event as MessageEvent<string>).data) as Partial<
          MenuServingStatusUpdate
        >;
        if (
          typeof data.menuServingId === "string" &&
          typeof data.status === "string" &&
          typeof data.updatedAt === "string"
        ) {
          onStatusUpdate(data as MenuServingStatusUpdate);
        }
      } catch {
        // Ignore malformed event payloads; the next server event will resync state.
      }
    }

    source.addEventListener("menu-serving-status-updated", handleStatusUpdate);

    return () => {
      source.removeEventListener("menu-serving-status-updated", handleStatusUpdate);
      source.close();
    };
  }, [onStatusUpdate]);
}

export function applyMenuServingStatusUpdate<T extends MenuServingStatusTarget>(
  items: T[],
  event: MenuServingStatusUpdate,
) {
  if (event.status === "HIDDEN") {
    return items.filter((item) => item.id !== event.menuServingId);
  }

  return items.map((item) =>
    item.id === event.menuServingId ? { ...item, status: event.status } : item,
  );
}
