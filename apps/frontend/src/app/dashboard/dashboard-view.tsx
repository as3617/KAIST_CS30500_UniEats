"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Filter, MapPinned, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError, api } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import { todayInSeoul, formatPriceKRW } from "@/lib/date";
import {
  ALLERGY_LABELS,
  CATEGORY_CODES,
  CATEGORY_LABELS,
  DIETARY_LABEL_CODES,
  DIETARY_LABELS,
  MEAL_TIMES,
  MEAL_TIME_LABELS,
} from "@/types";
import type {
  Cafeteria,
  CategoryCode,
  DietaryLabelCode,
  MealTime,
  MenuServing,
  PaginatedData,
  User,
} from "@/types";

export function DashboardView() {
  const today = useMemo(() => todayInSeoul(), []);
  const [items, setItems] = useState<MenuServing[]>([]);
  const [user, setUser] = useState<Pick<
    User,
    "id" | "email" | "nickname" | "role" | "isEmailVerified"
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<CategoryCode | "">("");
  const [dietaryLabel, setDietaryLabel] = useState<DietaryLabelCode | "">("");
  const [cafeteriaId, setCafeteriaId] = useState("");
  const [mealTime, setMealTime] = useState<MealTime | "">("");
  const [hideAllergyConflicts, setHideAllergyConflicts] = useState(false);
  const hasActiveFilters = Boolean(
    searchQuery ||
      category ||
      dietaryLabel ||
      cafeteriaId ||
      mealTime ||
      hideAllergyConflicts,
  );

  useEffect(() => {
    setUser(authStorage.getUser());
  }, []);

  useEffect(() => {
    let isCurrent = true;

    api
      .get<Cafeteria[]>("/cafeterias")
      .then((data) => {
        if (isCurrent) setCafeterias(data);
      })
      .catch(() => {
        if (isCurrent) setCafeterias([]);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const fetchMenu = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<PaginatedData<MenuServing>>("/menu-servings", {
        query: {
          date: today,
          q: searchQuery || undefined,
          category: category || undefined,
          dietaryLabel: dietaryLabel || undefined,
          cafeteriaId: cafeteriaId || undefined,
          mealTime: mealTime || undefined,
          hideAllergyConflicts: hideAllergyConflicts ? "true" : undefined,
          limit: 20,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to load menu");
      }
    } finally {
      setIsLoading(false);
    }
  }, [today, searchQuery, category, dietaryLabel, cafeteriaId, mealTime, hideAllergyConflicts]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  function handleSignOut() {
    authStorage.clear();
    setUser(null);
    setHideAllergyConflicts(false);
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  }

  function resetFilters() {
    setSearchInput("");
    setSearchQuery("");
    setCategory("");
    setDietaryLabel("");
    setCafeteriaId("");
    setMealTime("");
    setHideAllergyConflicts(false);
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
          <Button asChild variant="outline" size="sm">
            <Link href="/campus-map">
              <MapPinned className="h-4 w-4" />
              Map
            </Link>
          </Button>
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{user.nickname}</span>
              </span>
              <Button asChild variant="outline" size="sm">
                <Link href="/my-page">My Page</Link>
              </Button>
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
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Find a meal</CardTitle>
            <CardDescription>
              Search today&apos;s menus by category, cafeteria, or dietary option.
            </CardDescription>
          </div>
          <Filter className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Label htmlFor="menu-search" className="sr-only">
              Search meals
            </Label>
            <Input
              id="menu-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search meals or ingredients"
            />
            <Button type="submit" aria-label="Search meals">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
            </Button>
          </form>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button
              type="button"
              size="sm"
              variant={category === "" ? "default" : "outline"}
              onClick={() => setCategory("")}
            >
              All
            </Button>
            {CATEGORY_CODES.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={category === value ? "default" : "outline"}
                onClick={() => setCategory(value)}
              >
                {CATEGORY_LABELS[value]}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cafeteria-filter">Cafeteria</Label>
              <select
                id="cafeteria-filter"
                value={cafeteriaId}
                onChange={(event) => setCafeteriaId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All cafeterias</option>
                {cafeterias.map((cafeteria) => (
                  <option key={cafeteria.id} value={cafeteria.id}>
                    {cafeteria.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meal-time-filter">Meal time</Label>
              <select
                id="meal-time-filter"
                value={mealTime}
                onChange={(event) => setMealTime(event.target.value as MealTime | "")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All times</option>
                {MEAL_TIMES.map((value) => (
                  <option key={value} value={value}>
                    {MEAL_TIME_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dietary-filter">Dietary option</Label>
              <select
                id="dietary-filter"
                value={dietaryLabel}
                onChange={(event) =>
                  setDietaryLabel(event.target.value as DietaryLabelCode | "")
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Any option</option>
                {DIETARY_LABEL_CODES.map((value) => (
                  <option key={value} value={value}>
                    {DIETARY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
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
            {hasActiveFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-4 w-4" />
                Clear filters
              </Button>
            ) : null}
          </div>
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
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Showing {items.length} of {total} available menu items
          </p>
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.id}>
                <MenuServingCard serving={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function MenuServingCard({ serving }: { serving: MenuServing }) {
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
