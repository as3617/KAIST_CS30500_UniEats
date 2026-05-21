"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Filter } from "lucide-react";

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
import { authStorage } from "@/lib/auth-storage";
import { todayInSeoul, formatPriceKRW } from "@/lib/date";
import { CATEGORY_LABELS, ALLERGY_LABELS } from "@/types";
import type { MenuServing, PaginatedData, User } from "@/types";

export function DashboardView() {
  const today = useMemo(() => todayInSeoul(), []);
  const [items, setItems] = useState<MenuServing[]>([]);
  const [user, setUser] = useState<Pick<
    User,
    "id" | "email" | "nickname" | "role" | "isEmailVerified"
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideAllergyConflicts, setHideAllergyConflicts] = useState(false);

  useEffect(() => {
    setUser(authStorage.getUser());
  }, []);

  const fetchMenu = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<PaginatedData<MenuServing>>("/menu-servings", {
        query: {
          date: today,
          hideAllergyConflicts: hideAllergyConflicts ? "true" : undefined,
          limit: 20,
        },
      });
      setItems(data.items);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to load menu");
      }
    } finally {
      setIsLoading(false);
    }
  }, [today, hideAllergyConflicts]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  function handleSignOut() {
    authStorage.clear();
    setUser(null);
  }

  return (
    <main className="container max-w-4xl space-y-8 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Today &middot; {today}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Cafeteria menu</h1>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{user.nickname}</span>
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>
              Personalised allergy filtering is available after signing in.
            </CardDescription>
          </div>
          <Filter className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hideAllergyConflicts}
              onChange={(event) => setHideAllergyConflicts(event.target.checked)}
              disabled={!user}
              className="h-4 w-4 rounded border-input"
            />
            <span className={user ? "" : "text-muted-foreground"}>
              Hide meals that conflict with my allergy profile
              {!user ? " (sign in required)" : ""}
            </span>
          </label>
        </CardContent>
      </Card>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading menu...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No menu items found for today.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <MenuServingCard serving={item} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function MenuServingCard({ serving }: { serving: MenuServing }) {
  const isSoldOut = serving.status === "SOLD_OUT";
  const hasAllergyConflict = serving.allergyWarning?.hasConflict ?? false;

  return (
    <Card className="h-full">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">{serving.meal.name}</CardTitle>
          <Badge variant={isSoldOut ? "destructive" : "secondary"}>
            {isSoldOut ? "Sold out" : serving.mealTime}
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
            ★ {serving.averageRating.toFixed(1)} ({serving.verifiedReviewCount})
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
          {serving.meal.allergens.map((a) => (
            <Badge key={a} variant="outline" className="text-xs">
              {ALLERGY_LABELS[a]}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
