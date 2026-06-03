"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Clock3, LocateFixed, MapPin, UtensilsCrossed } from "lucide-react";

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

type CampusMapViewProps = {
  kakaoMapAppKey: string;
};

type KakaoLatLng = unknown;
type KakaoMap = {
  setBounds(bounds: unknown): void;
  setCenter(position: KakaoLatLng): void;
  panTo(position: KakaoLatLng): void;
  relayout(): void;
  addControl(control: unknown, position: unknown): void;
};
type KakaoMarker = { setMap(map: KakaoMap | null): void };
type KakaoCustomOverlay = { setMap(map: KakaoMap | null): void };
type KakaoMaps = {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => { extend(position: KakaoLatLng): void };
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  Marker: new (options: {
    map: KakaoMap;
    position: KakaoLatLng;
    title?: string;
    clickable?: boolean;
  }) => KakaoMarker;
  CustomOverlay: new (options: {
    map: KakaoMap;
    position: KakaoLatLng;
    content: HTMLElement;
    yAnchor?: number;
    zIndex?: number;
  }) => KakaoCustomOverlay;
  ZoomControl: new () => unknown;
  MapTypeControl: new () => unknown;
  ControlPosition: {
    RIGHT: unknown;
    TOPRIGHT: unknown;
  };
  event: {
    addListener(target: unknown, eventName: string, handler: () => void): void;
  };
};
type KakaoNamespace = { maps: KakaoMaps };

declare global {
  interface Window {
    kakao?: KakaoNamespace;
    __unieatsKakaoMapsPromise?: Promise<KakaoNamespace>;
  }
}

const KAKAO_SDK_ID = "kakao-map-sdk";
const KAIST_CENTER = { lat: 36.3721, lng: 127.3607 };
const MAIN_CAMPUS_CLUSTER_DEGREES = 0.015;
const KAKAO_MAP_AUTH_ERROR =
  "Kakao Maps authorization failed. Check the JavaScript key and registered Web platform domain.";

export function CampusMapView({ kakaoMapAppKey }: CampusMapViewProps) {
  const today = useMemo(() => weekdayInSeoul(), []);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markerRefs = useRef<Array<KakaoMarker | KakaoCustomOverlay>>([]);
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapStatus, setMapStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    api
      .get<Cafeteria[]>("/cafeterias")
      .then((data) => {
        if (!isCurrent) return;
        setCafeterias(data);
        setSelectedId(pickDefaultCafeteria(data)?.id ?? data[0]?.id ?? null);
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
  const mapStatusLabel =
    mapStatus === "ready"
      ? "Map ready"
      : mapStatus === "error"
        ? "Map unavailable"
        : "Map loading";
  const positionedCafeterias = useMemo(
    () => cafeterias.filter(hasCoordinates),
    [cafeterias],
  );
  const visibleMapCafeterias = useMemo(
    () => buildNearbyCafeterias(positionedCafeterias, selectedCafeteria),
    [positionedCafeterias, selectedCafeteria],
  );
  const selectableCafeterias =
    positionedCafeterias.length > 0 ? positionedCafeterias : cafeterias;
  const pinPositions = useMemo(
    () => buildPinPositions(visibleMapCafeterias),
    [visibleMapCafeterias],
  );

  const clearMarkers = useCallback(() => {
    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = [];
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!kakaoMapAppKey.trim()) {
      setMapError("Kakao map app key is not configured.");
      setMapStatus("error");
      return;
    }
    if (!mapContainerRef.current || positionedCafeterias.length === 0) {
      return;
    }

    let cancelled = false;
    setMapStatus("loading");
    setMapError(null);

    loadKakaoMaps(kakaoMapAppKey)
      .then((kakao) => {
        if (cancelled || !mapContainerRef.current) return;

        const first = pickDefaultCafeteria(positionedCafeterias) ?? positionedCafeterias[0];
        const center = selectedCafeteria && hasCoordinates(selectedCafeteria)
          ? selectedCafeteria
          : first;
        const map =
          mapRef.current ??
          new kakao.maps.Map(mapContainerRef.current, {
            center: new kakao.maps.LatLng(
              center.location.lat ?? KAIST_CENTER.lat,
              center.location.lng ?? KAIST_CENTER.lng,
            ),
            level: visibleMapCafeterias.length > 1 ? 4 : 3,
          });

        if (!mapRef.current) {
          map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
          map.addControl(
            new kakao.maps.MapTypeControl(),
            kakao.maps.ControlPosition.TOPRIGHT,
          );
          mapRef.current = map;
        }

        map.relayout();
        clearMarkers();
        const bounds = new kakao.maps.LatLngBounds();

        visibleMapCafeterias.forEach((cafeteria) => {
          const position = new kakao.maps.LatLng(
            cafeteria.location.lat!,
            cafeteria.location.lng!,
          );
          bounds.extend(position);

          const marker = new kakao.maps.Marker({
            map,
            position,
            title: cafeteria.name,
            clickable: true,
          });
          kakao.maps.event.addListener(marker, "click", () => setSelectedId(cafeteria.id));
          markerRefs.current.push(marker);

          const overlayContent = createMarkerLabel(
            cafeteria.name,
            cafeteria.id === selectedId,
          );
          overlayContent.addEventListener("click", () => setSelectedId(cafeteria.id));
          const overlay = new kakao.maps.CustomOverlay({
            map,
            position,
            content: overlayContent,
            yAnchor: 2.2,
            zIndex: cafeteria.id === selectedId ? 10 : 1,
          });
          markerRefs.current.push(overlay);
        });

        if (visibleMapCafeterias.length > 1) {
          map.setBounds(bounds);
        } else if (visibleMapCafeterias[0]) {
          map.setCenter(
            new kakao.maps.LatLng(
              visibleMapCafeterias[0].location.lat!,
              visibleMapCafeterias[0].location.lng!,
            ),
          );
        }

        if (selectedCafeteria && hasCoordinates(selectedCafeteria)) {
          map.panTo(
            new kakao.maps.LatLng(
              selectedCafeteria.location.lat!,
              selectedCafeteria.location.lng!,
            ),
          );
        }

        setMapStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setMapError(err instanceof Error ? err.message : KAKAO_MAP_AUTH_ERROR);
        setMapStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [
    clearMarkers,
    isLoading,
    kakaoMapAppKey,
    positionedCafeterias,
    selectedCafeteria,
    selectedId,
    visibleMapCafeterias,
  ]);

  useEffect(() => {
    return () => clearMarkers();
  }, [clearMarkers]);

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
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">KAIST campus dining map</CardTitle>
                  <CardDescription>
                    Locations are plotted with Kakao Maps from cafeteria coordinates.
                  </CardDescription>
                </div>
                <Badge variant={mapStatus === "ready" ? "secondary" : "outline"}>
                  {mapStatusLabel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative h-[430px] overflow-hidden rounded-lg border bg-slate-50">
                <div ref={mapContainerRef} className="absolute inset-0" />
                {mapStatus === "loading" ? (
                  <p className="absolute inset-0 flex items-center justify-center bg-background/75 text-sm text-muted-foreground">
                    Loading Kakao map...
                  </p>
                ) : null}
                {cafeterias.length === 0 ? (
                  <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    No operating cafeterias found.
                  </p>
                ) : null}
                {positionedCafeterias.length === 0 && cafeterias.length > 0 ? (
                  <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    Cafeteria coordinates are not available.
                  </p>
                ) : null}
                {mapError ? (
                  <MapFallback
                    cafeterias={visibleMapCafeterias}
                    pinPositions={pinPositions}
                    selectedId={selectedId}
                    error={mapError}
                    onSelect={setSelectedId}
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>

          {selectedCafeteria ? (
            <CafeteriaPanel
              cafeteria={selectedCafeteria}
              cafeterias={selectableCafeterias}
              selectedId={selectedId}
              today={today}
              onSelect={setSelectedId}
            />
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
  cafeterias,
  selectedId,
  today,
  onSelect,
}: {
  cafeteria: Cafeteria;
  cafeterias: Cafeteria[];
  selectedId: string | null;
  today: keyof Cafeteria["openingHours"];
  onSelect: (id: string) => void;
}) {
  const hours = cafeteria.openingHours[today] ?? [];
  const location = [cafeteria.location.building, cafeteria.location.floor]
    .filter(Boolean)
    .join(" ");
  const hasLocation = hasCoordinates(cafeteria);

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
        <div className="space-y-2">
          <label
            htmlFor="cafeteria-picker"
            className="text-sm font-medium text-muted-foreground"
          >
            Cafeteria
          </label>
          <select
            id="cafeteria-picker"
            value={selectedId ?? ""}
            onChange={(event) => onSelect(event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {cafeterias.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
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
          {hasLocation ? (
            <p>
              {cafeteria.location.lat!.toFixed(4)}, {cafeteria.location.lng!.toFixed(4)}
            </p>
          ) : null}
        </div>
        {hasLocation ? (
          <Button asChild variant="outline" className="w-full">
            <a
              href={`https://map.kakao.com/link/map/${encodeURIComponent(
                cafeteria.name,
              )},${cafeteria.location.lat},${cafeteria.location.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              <LocateFixed className="h-4 w-4" />
              Open in Kakao Map
            </a>
          </Button>
        ) : null}
        <Button asChild className="w-full">
          <Link href={`/dashboard?cafeteriaId=${encodeURIComponent(cafeteria.id)}`}>
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

function MapFallback({
  cafeterias,
  pinPositions,
  selectedId,
  error,
  onSelect,
}: {
  cafeterias: Cafeteria[];
  pinPositions: Map<string, { left: number; top: number }>;
  selectedId: string | null;
  error: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="absolute inset-0 bg-slate-50">
      <MapBackdrop />
      <p className="absolute inset-x-4 top-4 rounded-md border bg-background/95 px-3 py-2 text-sm text-muted-foreground shadow-sm">
        {error}
      </p>
      {cafeterias.map((cafeteria) => {
        const point = pinPositions.get(cafeteria.id);
        if (!point) return null;
        const selected = cafeteria.id === selectedId;

        return (
          <button
            key={cafeteria.id}
            type="button"
            aria-label={`Show ${cafeteria.name}`}
            onClick={() => onSelect(cafeteria.id)}
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
      <p className="absolute left-5 bottom-5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        KAIST
      </p>
    </>
  );
}

function hasCoordinates(cafeteria: Cafeteria) {
  return (
    typeof cafeteria.location.lat === "number" &&
    Number.isFinite(cafeteria.location.lat) &&
    typeof cafeteria.location.lng === "number" &&
    Number.isFinite(cafeteria.location.lng)
  );
}

function pickDefaultCafeteria(cafeterias: Cafeteria[]) {
  return (
    cafeterias.find((cafeteria) => hasCoordinates(cafeteria) && cafeteria.name.includes("카이마루")) ??
    cafeterias.find(hasCoordinates)
  );
}

function buildNearbyCafeterias(
  positionedCafeterias: Cafeteria[],
  selectedCafeteria: Cafeteria | null,
) {
  if (positionedCafeterias.length <= 1) {
    return positionedCafeterias;
  }

  const anchor =
    selectedCafeteria && hasCoordinates(selectedCafeteria)
      ? selectedCafeteria
      : pickDefaultCafeteria(positionedCafeterias) ?? positionedCafeterias[0];
  const nearby = positionedCafeterias.filter(
    (cafeteria) =>
      Math.abs(cafeteria.location.lat! - anchor.location.lat!) <=
        MAIN_CAMPUS_CLUSTER_DEGREES &&
      Math.abs(cafeteria.location.lng! - anchor.location.lng!) <=
        MAIN_CAMPUS_CLUSTER_DEGREES,
  );

  return nearby.length > 0 ? nearby : [anchor];
}

function createMarkerLabel(name: string, selected: boolean) {
  const label = document.createElement("button");
  label.type = "button";
  label.textContent = name;
  label.style.border = "0";
  label.style.borderRadius = "999px";
  label.style.boxShadow = "0 10px 25px rgba(15, 23, 42, 0.18)";
  label.style.cursor = "pointer";
  label.style.fontSize = "12px";
  label.style.fontWeight = "600";
  label.style.lineHeight = "1";
  label.style.maxWidth = "180px";
  label.style.overflow = "hidden";
  label.style.padding = "8px 10px";
  label.style.textOverflow = "ellipsis";
  label.style.whiteSpace = "nowrap";
  label.style.background = selected ? "hsl(221 83% 53%)" : "white";
  label.style.color = selected ? "white" : "hsl(222 47% 11%)";
  return label;
}

function buildPinPositions(cafeterias: Cafeteria[]) {
  const positioned = cafeterias.filter(hasCoordinates);
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
    positions.set(cafeteria.id, {
      left: 18 + ((cafeteria.location.lng! - minLng) / lngSpan) * 64,
      top:
        positioned.length === 1
          ? 52
          : 78 - ((cafeteria.location.lat! - minLat) / latSpan) * 56 + (index % 2) * 2,
    });
  });

  return positions;
}

function loadKakaoMaps(appKey: string) {
  if (window.kakao?.maps) {
    return new Promise<KakaoNamespace>((resolve) => {
      window.kakao!.maps.load(() => resolve(window.kakao!));
    });
  }

  if (window.__unieatsKakaoMapsPromise) {
    return window.__unieatsKakaoMapsPromise;
  }

  window.__unieatsKakaoMapsPromise = new Promise<KakaoNamespace>((resolve, reject) => {
    const existingScript = document.getElementById(KAKAO_SDK_ID) as HTMLScriptElement | null;

    const handleLoad = () => {
      if (!window.kakao?.maps) {
        reject(new Error(KAKAO_MAP_AUTH_ERROR));
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao!));
    };

    if (existingScript) {
      if (window.kakao?.maps) {
        handleLoad();
        return;
      }
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", () => reject(new Error(KAKAO_MAP_AUTH_ERROR)), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = KAKAO_SDK_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      appKey,
    )}&autoload=false`;
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", () => reject(new Error(KAKAO_MAP_AUTH_ERROR)), {
      once: true,
    });
    document.head.appendChild(script);
  }).catch((error) => {
    window.__unieatsKakaoMapsPromise = undefined;
    throw error;
  });

  return window.__unieatsKakaoMapsPromise;
}
