"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, MapPin } from "lucide-react";

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
import { formatPriceKRW } from "@/lib/date";
import {
  ALLERGY_LABELS,
  CATEGORY_LABELS,
  DIETARY_LABELS,
  MEAL_TIME_LABELS,
} from "@/types";
import type { MenuServingDetail } from "@/types";

type MenuServingDetailViewProps = {
  menuServingId: string;
};

export function MenuServingDetailView({
  menuServingId,
}: MenuServingDetailViewProps) {
  const [serving, setServing] = useState<MenuServingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    setIsLoading(true);
    setError(null);
    api
      .get<MenuServingDetail>(`/menu-servings/${menuServingId}`)
      .then((data) => {
        if (isCurrent) setServing(data);
      })
      .catch((err) => {
        if (!isCurrent) return;
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError("Failed to load meal details");
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [menuServingId]);

  if (isLoading) {
    return (
      <main className="container max-w-3xl py-8">
        <p className="text-sm text-muted-foreground">Loading meal details...</p>
      </main>
    );
  }

  if (error || !serving) {
    return (
      <main className="container max-w-3xl space-y-4 py-8">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error ?? "Meal details are unavailable."}
        </p>
      </main>
    );
  }

  const isSoldOut = serving.status === "SOLD_OUT";
  const hasAllergyConflict = serving.allergyWarning?.hasConflict ?? false;
  const location = [serving.cafeteria.location.building, serving.cafeteria.location.floor]
    .filter(Boolean)
    .join(" ");
  const nutrition = [
    { label: "Calories", value: serving.meal.nutrition.calories, unit: "kcal" },
    { label: "Carbohydrate", value: serving.meal.nutrition.carbohydrate, unit: "g" },
    { label: "Protein", value: serving.meal.nutrition.protein, unit: "g" },
    { label: "Fat", value: serving.meal.nutrition.fat, unit: "g" },
    { label: "Sodium", value: serving.meal.nutrition.sodium, unit: "mg" },
  ].filter((fact) => fact.value !== undefined);

  return (
    <main className="container max-w-3xl space-y-6 py-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </Button>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <CardDescription>{CATEGORY_LABELS[serving.meal.category]}</CardDescription>
              <CardTitle className="text-3xl">{serving.meal.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {serving.meal.description ?? "No description available."}
              </p>
            </div>
            <Badge variant={isSoldOut ? "destructive" : "secondary"}>
              {isSoldOut ? "Sold out" : "Available"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{formatPriceKRW(serving.price)}</span>
            <span>{MEAL_TIME_LABELS[serving.mealTime]}</span>
            <span>
              {serving.averageRating.toFixed(1)} / 5 ({serving.verifiedReviewCount} verified)
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {hasAllergyConflict ? (
            <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Allergy warning</p>
                <p>
                  Contains{" "}
                  {serving.allergyWarning!.matchedAllergens
                    .map((allergen) => ALLERGY_LABELS[allergen])
                    .join(", ")}
                  .
                </p>
              </div>
            </div>
          ) : null}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Dietary labels</h2>
            <div className="flex flex-wrap gap-2">
              {serving.meal.dietaryLabels.length > 0 ? (
                serving.meal.dietaryLabels.map((label) => (
                  <Badge key={label} variant="secondary">
                    {DIETARY_LABELS[label]}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No dietary labels</span>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Ingredients and allergens</h2>
            <p className="text-sm text-muted-foreground">
              {serving.meal.ingredients.join(", ")}
            </p>
            <div className="flex flex-wrap gap-2">
              {serving.meal.allergens.map((allergen) => (
                <Badge key={allergen} variant="outline">
                  {ALLERGY_LABELS[allergen]}
                </Badge>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Nutrition</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {nutrition.map((fact) => (
                <div key={fact.label} className="rounded-md bg-muted p-3">
                  <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                  <dd className="mt-1 font-medium">
                    {fact.value}
                    {fact.unit}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cafeteria</CardTitle>
          <CardDescription>{serving.cafeteria.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {location ? (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {location}
            </p>
          ) : null}
          {serving.cafeteria.description ? (
            <p className="text-muted-foreground">{serving.cafeteria.description}</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
