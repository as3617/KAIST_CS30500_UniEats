import { Injectable, MessageEvent } from "@nestjs/common";
import { interval, merge, Observable, of, Subject } from "rxjs";
import { map } from "rxjs/operators";
import { MenuServingStatus } from "../common/enums";

export type MenuServingStatusUpdateEvent = {
  menuServingId: string;
  status: MenuServingStatus;
  updatedAt: string;
};

@Injectable()
export class MenuServingEventsService {
  private readonly statusUpdates = new Subject<MessageEvent>();

  stream(): Observable<MessageEvent> {
    return merge(
      of({
        type: "connected",
        data: { connectedAt: new Date().toISOString() },
      }),
      interval(30_000).pipe(
        map(() => ({
          type: "heartbeat",
          data: { at: new Date().toISOString() },
        })),
      ),
      this.statusUpdates.asObservable(),
    );
  }

  publishStatusUpdate(event: MenuServingStatusUpdateEvent) {
    this.statusUpdates.next({
      type: "menu-serving-status-updated",
      data: event,
    });
  }
}
