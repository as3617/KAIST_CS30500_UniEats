"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { AlertTriangle, MessageCircle, Star } from "lucide-react";

import { FavoriteMealButton } from "@/components/favorite-meal-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPriceKRW } from "@/lib/date";
import {
  ALLERGY_LABELS,
  CATEGORY_LABELS,
  DIETARY_LABELS,
  MEAL_TIME_LABELS,
} from "@/types";
import type { MenuServing } from "@/types";

const DAILY_MENU_TIME_LABELS: Record<MenuServing["mealTime"], string> = {
  BREAKFAST: "조식",
  LUNCH: "중식",
  DINNER: "석식",
  ALL_DAY: "상시",
};

export function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(1, Math.max(0, rating - (star - 1)));
        return (
          <span key={star} className="relative inline-block h-3.5 w-3.5">
            <Star className="absolute h-3.5 w-3.5 fill-muted text-muted-foreground/30" />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            </span>
          </span>
        );
      })}
    </div>
  );
}

type MenuServingCardProps = {
  serving: MenuServing;
  isFavorite?: boolean;
  isFavoritePending?: boolean;
  onToggleFavorite?: (serving: MenuServing) => void;
};

export function MenuServingCard({
  serving,
  isFavorite = false,
  isFavoritePending = false,
  onToggleFavorite,
}: MenuServingCardProps) {
  const router = useRouter();
  const isSoldOut = serving.status === "SOLD_OUT";
  const hasAllergyConflict = serving.allergyWarning?.hasConflict ?? false;
  const activeDiscount =
    serving.activeDiscount &&
    serving.activeDiscount.discountedPrice < serving.price
      ? serving.activeDiscount
      : null;
  const displayTitle = buildMenuServingCardTitle(serving);
  const description = buildMenuServingCardDescription(serving);
  const detailPath = `/menu-servings/${serving.id}`;

  function openDetailPage() {
    router.push(detailPath);
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetailPage();
    }
  }

  return (
    <Card
      role="link"
      tabIndex={0}
      aria-label={displayTitle}
      onClick={openDetailPage}
      onKeyDown={handleCardKeyDown}
      className="h-full flex flex-col bg-card shadow-sm transition-colors hover:border-primary/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="text-lg leading-tight">
              {displayTitle}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {activeDiscount ? (
              <Badge variant="outline" className="border-primary/40 text-primary">
                Promo
              </Badge>
            ) : null}
            <Badge variant={isSoldOut ? "destructive" : "secondary"}>
              {isSoldOut ? "Sold out" : MEAL_TIME_LABELS[serving.mealTime]}
            </Badge>
            {onToggleFavorite ? (
              <span
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <FavoriteMealButton
                  isFavorite={isFavorite}
                  isPending={isFavoritePending}
                  onToggle={() => onToggleFavorite(serving)}
                />
              </span>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 text-sm">
        {hasAllergyConflict ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-medium">Allergy warning</p>
              <p className="text-xs">
                Contains:{" "}
                {serving.allergyWarning!.matchedAllergens
                  .map((a) => ALLERGY_LABELS[a])
                  .join(", ")}
              </p>
            </div>
          </div>
        ) : null}
        <div className="mt-auto space-y-3">
          <div className="flex flex-wrap gap-1">
            {serving.meal.dietaryLabels.map((label) => (
              <Badge key={label} variant="outline" className="text-xs">
                {DIETARY_LABELS[label]}
              </Badge>
            ))}
          </div>
          <div className="border-t pt-3 flex items-center justify-between">
          <Link
            href={`/menu-servings/${serving.id}/reviews`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="flex items-center gap-2 rounded-md hover:bg-muted px-1 -mx-1 py-0.5"
          >
            <span className="text-xs font-medium">{serving.averageRating.toFixed(1)}</span>
            <StarRating rating={serving.averageRating} />
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" />
              {serving.verifiedReviewCount}
            </span>
          </Link>
          {activeDiscount ? (
            <div className="flex flex-col items-end leading-tight">
              <span className="text-base font-bold text-primary">
                {formatPriceKRW(activeDiscount.discountedPrice)}
              </span>
              <span className="text-xs text-muted-foreground line-through">
                {formatPriceKRW(serving.price)}
              </span>
            </div>
          ) : (
            <span className="text-base font-bold">{formatPriceKRW(serving.price)}</span>
          )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function buildMenuServingCardTitle(serving: MenuServing) {
  if (serving.source === "DAILY_MENU") {
    const timeLabel = DAILY_MENU_TIME_LABELS[serving.mealTime];
    const { prefix, section } = parseDailyMenuName(serving, timeLabel);
    return `${prefix || serving.cafeteria.name} ${timeLabel} - ${section || "일반 메뉴"}`;
  }

  return serving.meal.name;
}

function buildMenuServingCardDescription(serving: MenuServing) {
  if (serving.source === "DAILY_MENU") {
    return `${serving.cafeteria.name} · ${DAILY_MENU_TIME_LABELS[serving.mealTime]} · ${serving.date} · ${CATEGORY_LABELS[serving.meal.category]}`;
  }

  return `${serving.cafeteria.name} · ${CATEGORY_LABELS[serving.meal.category]}`;
}

function parseDailyMenuName(serving: MenuServing, timeLabel: string) {
  const nameWithoutItems = serving.meal.name.split(" - ")[0]?.trim() ?? "";
  const dateSuffix = ` ${serving.date}`;
  const nameWithoutDate = nameWithoutItems.endsWith(dateSuffix)
    ? nameWithoutItems.slice(0, -dateSuffix.length).trim()
    : nameWithoutItems;
  const timeIndex = nameWithoutDate.lastIndexOf(` ${timeLabel}`);

  if (timeIndex === -1) {
    return { prefix: serving.cafeteria.name, section: "" };
  }

  return {
    prefix: nameWithoutDate.slice(0, timeIndex).trim(),
    section: nameWithoutDate.slice(timeIndex + timeLabel.length + 1).trim(),
  };
}
