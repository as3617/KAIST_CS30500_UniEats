"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Search, SlidersHorizontal, X } from "lucide-react";

import { MenuServingCard } from "@/components/menu-serving-card";
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
import { todayInSeoul } from "@/lib/date";
import { useFavoriteMeals } from "@/lib/use-favorite-meals";
import {
  applyMenuServingStatusUpdate,
  useMenuServingStatusEvents,
} from "@/lib/menu-serving-events";
import type { MenuServingStatusUpdate } from "@/lib/menu-serving-events";
import {
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

type SearchViewProps = {
  initialQuery?: string;
};

export function SearchView({ initialQuery = "" }: SearchViewProps) {
  const today = useMemo(() => todayInSeoul(), []);
  const normalizedInitialQuery = initialQuery.trim();
  const [items, setItems] = useState<MenuServing[]>([]);
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [user, setUser] = useState<Pick<User, "id" | "email" | "nickname"> | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState(normalizedInitialQuery);
  const [searchQuery, setSearchQuery] = useState(normalizedInitialQuery);
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<CategoryCode | "">("");
  const [dietaryLabel, setDietaryLabel] = useState<DietaryLabelCode | "">("");
  const [cafeteriaId, setCafeteriaId] = useState("");
  const [mealTime, setMealTime] = useState<MealTime | "">("");
  const [hideAllergyConflicts, setHideAllergyConflicts] = useState(false);
  const {
    favoriteMealIds,
    pendingMealIds: pendingFavoriteMealIds,
    toggleFavorite,
  } = useFavoriteMeals(Boolean(user));

  const hasActiveFilters = Boolean(
    searchQuery ||
      date !== today ||
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

  const fetchResults = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.get<PaginatedData<MenuServing>>("/menu-servings", {
        query: {
          date,
          q: searchQuery || undefined,
          category: category || undefined,
          dietaryLabel: dietaryLabel || undefined,
          cafeteriaId: cafeteriaId || undefined,
          mealTime: mealTime || undefined,
          hideAllergyConflicts: hideAllergyConflicts ? "true" : undefined,
          limit: 40,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to search menus");
    } finally {
      setIsLoading(false);
    }
  }, [date, searchQuery, category, dietaryLabel, cafeteriaId, mealTime, hideAllergyConflicts]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleMenuServingStatusUpdate = useCallback((event: MenuServingStatusUpdate) => {
    setItems((current) => applyMenuServingStatusUpdate(current, event));
  }, []);

  useMenuServingStatusEvents(handleMenuServingStatusUpdate);

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  }

  function resetFilters() {
    setSearchInput("");
    setSearchQuery("");
    setDate(today);
    setCategory("");
    setDietaryLabel("");
    setCafeteriaId("");
    setMealTime("");
    setHideAllergyConflicts(false);
  }

  async function handleToggleFavorite(serving: MenuServing) {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    try {
      await toggleFavorite(serving.meal.id);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to update favorite meal.",
      );
    }
  }

  return (
    <main className="container max-w-5xl space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Search</p>
          <h1 className="text-3xl font-semibold tracking-tight">Find campus meals</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Search by meal, ingredient, or cafeteria, then narrow results with cuisine,
            dining hall, meal time, and dietary filters.
          </p>
        </div>
        {hasActiveFilters ? (
          <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
            <X className="h-4 w-4" />
            Clear
          </Button>
        ) : null}
      </header>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Search filters</CardTitle>
            <CardDescription>
              Combine text search with structured meal and cafeteria filters.
            </CardDescription>
          </div>
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Label htmlFor="search-query" className="sr-only">
              Search meals
            </Label>
            <Input
              id="search-query"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search meals, ingredients, or cafeterias"
            />
            <Button type="submit" aria-label="Search meals">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
            </Button>
          </form>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search-date">Date</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="search-cafeteria">Cafeteria</Label>
              <select
                id="search-cafeteria"
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
              <Label htmlFor="search-meal-time">Meal time</Label>
              <select
                id="search-meal-time"
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
              <Label htmlFor="search-dietary">Dietary option</Label>
              <select
                id="search-dietary"
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

          <div className="space-y-3">
            <Label>Cuisine</Label>
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
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={hideAllergyConflicts}
              onChange={(event) => setHideAllergyConflicts(event.target.checked)}
              disabled={!user}
              className="mt-0.5 h-4 w-4 rounded border-input"
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
        <p className="text-sm text-muted-foreground">Searching menus...</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-10 text-center">
          <p className="text-sm font-medium">No matching meals found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try another date, cafeteria, cuisine, or dietary option.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Showing {items.length} of {total} matching menu items
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.id}>
                <MenuServingCard
                  serving={item}
                  isFavorite={favoriteMealIds.has(item.meal.id)}
                  isFavoritePending={pendingFavoriteMealIds.has(item.meal.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
