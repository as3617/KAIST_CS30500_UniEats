"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

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
  const isSoldOut = serving.status === "SOLD_OUT";
  const hasAllergyConflict = serving.allergyWarning?.hasConflict ?? false;

  return (
    <Card className="h-full transition-colors hover:border-primary/40">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="text-lg leading-tight">
              <Link
                href={`/menu-servings/${serving.id}`}
                className="hover:underline"
              >
                {serving.meal.name}
              </Link>
            </CardTitle>
            <CardDescription>
              {serving.cafeteria.name} &middot; {CATEGORY_LABELS[serving.meal.category]}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={isSoldOut ? "destructive" : "secondary"}>
              {isSoldOut ? "Sold out" : MEAL_TIME_LABELS[serving.mealTime]}
            </Badge>
            {onToggleFavorite ? (
              <FavoriteMealButton
                isFavorite={isFavorite}
                isPending={isFavoritePending}
                onToggle={() => onToggleFavorite(serving)}
              />
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">{formatPriceKRW(serving.price)}</span>
          <span className="text-muted-foreground">
            {serving.averageRating.toFixed(1)} / 5 ({serving.verifiedReviewCount})
          </span>
        </div>
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
        <div className="flex flex-wrap gap-1">
          {serving.meal.dietaryLabels.map((label) => (
            <Badge key={label} variant="outline" className="text-xs">
              {DIETARY_LABELS[label]}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
