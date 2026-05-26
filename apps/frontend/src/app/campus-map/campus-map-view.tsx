"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, MapPin, UtensilsCrossed } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiClientError, api } from "@/lib/api";
import { weekdayInSeoul } from "@/lib/date";
import type { Cafeteria, TimeRange } from "@/types";

export function CampusMapView() {
  const today = useMemo(() => weekdayInSeoul(), []);
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    api
      .get<Cafeteria[]>("/cafeterias")
      .then((data) => {
        if (!isCurrent) return;
        setCafeterias(data);
        setSelectedId(data[0]?.id ?? null);
      })
      .catch((err) => {
        if (!isCurrent) return;
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load cafeteria locations.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const selectedCafeteria =
    cafeterias.find((cafeteria) => cafeteria.id === selectedId) ?? null;
  const pinPositions = buildPinPositions(cafeterias);

  return (
    <main className="container max-w-5xl space-y-6 py-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </Button>

      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Explore campus</p>
        <h1 className="text-3xl font-semibold tracking-tight">Cafeteria map</h1>
        <p className="text-sm text-muted-foreground">
          Select a marker to check the dining hall location and today&apos;s operating hours.
        </p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading campus cafeterias...</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">KAIST campus dining map</CardTitle>
              <CardDescription>
                Locations are plotted from cafeteria coordinates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[430px] overflow-hidden rounded-xl border bg-slate-50">
                <MapBackdrop />
                {cafeterias.map((cafeteria) => {
                  const point = pinPositions.get(cafeteria.id);
                  if (!point) return null;
                  const selected = cafeteria.id === selectedId;

                  return (
                    <button
                      key={cafeteria.id}
                      type="button"
                      aria-label={`Show ${cafeteria.name}`}
                      onClick={() => setSelectedId(cafeteria.id)}
                      style={{ left: `${point.left}%`, top: `${point.top}%` }}
                      className="absolute -translate-x-1/2 -translate-y-full text-left"
                    >
                      <span
                        className={
                          selected
                            ? "flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-md"
                            : "flex items-center gap-1 rounded-full bg-background px-3 py-2 text-xs font-medium shadow-md ring-1 ring-border"
                        }
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        {cafeteria.name}
                      </span>
                    </button>
                  );
                })}
                {cafeterias.length === 0 ? (
                  <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    No operating cafeterias found.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {selectedCafeteria ? (
            <CafeteriaPanel cafeteria={selectedCafeteria} today={today} />
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Select a cafeteria marker to view details.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}

function CafeteriaPanel({
  cafeteria,
  today,
}: {
  cafeteria: Cafeteria;
  today: keyof Cafeteria["openingHours"];
}) {
  const hours = cafeteria.openingHours[today] ?? [];
  const location = [cafeteria.location.building, cafeteria.location.floor]
    .filter(Boolean)
    .join(" ");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{cafeteria.name}</CardTitle>
            <CardDescription>{location || "Campus location unavailable"}</CardDescription>
          </div>
          <Badge variant={hours.length ? "secondary" : "outline"}>
            {hours.length ? "Open today" : "Closed today"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {cafeteria.description ? (
          <p className="text-sm text-muted-foreground">{cafeteria.description}</p>
        ) : null}
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Clock3 className="h-4 w-4" />
            Today&apos;s hours
          </p>
          <HoursList hours={hours} />
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          {cafeteria.location.address ? <p>{cafeteria.location.address}</p> : null}
          {cafeteria.location.lat !== undefined &&
          cafeteria.location.lng !== undefined ? (
            <p>
              {cafeteria.location.lat.toFixed(4)}, {cafeteria.location.lng.toFixed(4)}
            </p>
          ) : null}
        </div>
        <Button asChild className="w-full">
          <Link href="/dashboard">
            <UtensilsCrossed className="h-4 w-4" />
            Browse menus
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function HoursList({ hours }: { hours: TimeRange[] }) {
  if (hours.length === 0) {
    return <p className="text-sm text-muted-foreground">No service scheduled today.</p>;
  }

  return (
    <div className="space-y-2">
      {hours.map((range) => (
        <div
          key={`${range.open}-${range.close}`}
          className="rounded-md bg-muted px-3 py-2 text-sm"
        >
          {range.open} - {range.close}
        </div>
      ))}
    </div>
  );
}

function MapBackdrop() {
  return (
    <>
      <div className="absolute inset-x-0 top-1/2 h-10 -translate-y-1/2 rotate-[-7deg] bg-white/80" />
      <div className="absolute left-1/2 top-0 h-full w-8 rotate-[14deg] bg-white/80" />
      <div className="absolute left-[18%] top-[18%] h-16 w-24 rounded-lg border bg-white/70" />
      <div className="absolute bottom-[18%] right-[18%] h-20 w-28 rounded-lg border bg-white/70" />
      <p className="absolute left-5 top-5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        KAIST
      </p>
    </>
  );
}

function buildPinPositions(cafeterias: Cafeteria[]) {
  const positioned = cafeterias.filter(
    (cafeteria) =>
      cafeteria.location.lat !== undefined && cafeteria.location.lng !== undefined,
  );
  const positions = new Map<string, { left: number; top: number }>();

  if (positioned.length === 0) return positions;

  const latitudes = positioned.map((cafeteria) => cafeteria.location.lat!);
  const longitudes = positioned.map((cafeteria) => cafeteria.location.lng!);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latSpan = maxLat - minLat || 0.001;
  const lngSpan = maxLng - minLng || 0.001;

  positioned.forEach((cafeteria, index) => {
    const longitude = cafeteria.location.lng!;
    const latitude = cafeteria.location.lat!;
    positions.set(cafeteria.id, {
      left: 18 + ((longitude - minLng) / lngSpan) * 64,
      top:
        positioned.length === 1
          ? 52
          : 78 - ((latitude - minLat) / latSpan) * 56 + (index % 2) * 2,
    });
  });

  return positions;
}
