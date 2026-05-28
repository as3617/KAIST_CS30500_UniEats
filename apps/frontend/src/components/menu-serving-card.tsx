"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

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

export function MenuServingCard({ serving }: { serving: MenuServing }) {
  const isSoldOut = serving.status === "SOLD_OUT";
  const hasAllergyConflict = serving.allergyWarning?.hasConflict ?? false;

  return (
    <Link href={`/menu-servings/${serving.id}`} className="block h-full">
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg">{serving.meal.name}</CardTitle>
            <Badge variant={isSoldOut ? "destructive" : "secondary"}>
              {isSoldOut ? "Sold out" : MEAL_TIME_LABELS[serving.mealTime]}
            </Badge>
          </div>
          <CardDescription>
            {serving.cafeteria.name} &middot; {CATEGORY_LABELS[serving.meal.category]}
          </CardDescription>
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
    </Link>
  );
}
