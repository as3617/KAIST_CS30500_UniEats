"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, CircleHelp, Filter, MessageCircle, Search, Tag, Trophy, X } from "lucide-react";

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
import { MenuServingCard, StarRating } from "@/components/menu-serving-card";
import { ApiClientError, api } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import { formatPriceKRW, todayInSeoul } from "@/lib/date";
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
  Discount,
  DietaryLabelCode,
  MealTime,
  MenuServing,
  PaginatedData,
  User,
  CafeteriaRankItem,
  WeeklyBestItem,
} from "@/types";

type DashboardViewProps = {
  initialCafeteriaId?: string;
};

const DASHBOARD_MENU_LIMIT = 20;

export function DashboardView({ initialCafeteriaId = "" }: DashboardViewProps) {
  const today = useMemo(() => todayInSeoul(), []);
  const [items, setItems] = useState<MenuServing[]>([]);
  const [user, setUser] = useState<Pick<
    User,
    "id" | "email" | "nickname" | "role" | "isEmailVerified"
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [weeklyBest, setWeeklyBest] = useState<WeeklyBestItem[]>([]);
  const [cafeteriaRanking, setCafeteriaRanking] = useState<CafeteriaRankItem[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isInsightsLoading, setIsInsightsLoading] = useState(true);
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<CategoryCode | "">("");
  const [dietaryLabel, setDietaryLabel] = useState<DietaryLabelCode | "">("");
  const [cafeteriaId, setCafeteriaId] = useState(initialCafeteriaId);
  const [mealTime, setMealTime] = useState<MealTime | "">("");
  const [hideAllergyConflicts, setHideAllergyConflicts] = useState(false);
  const {
    favoriteMealIds,
    pendingMealIds: pendingFavoriteMealIds,
    toggleFavorite,
  } = useFavoriteMeals(Boolean(user));
  const hasActiveFilters = Boolean(
    searchQuery ||
      category ||
      dietaryLabel ||
      cafeteriaId ||
      mealTime ||
      hideAllergyConflicts,
  );
  const totalPages = Math.max(1, Math.ceil(total / DASHBOARD_MENU_LIMIT));
  const pageNumbers = useMemo(
    () => buildPageNumbers(currentPage, totalPages),
    [currentPage, totalPages],
  );
  const firstVisibleItem = total === 0 ? 0 : (currentPage - 1) * DASHBOARD_MENU_LIMIT + 1;
  const lastVisibleItem = Math.min(total, firstVisibleItem + items.length - 1);

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
          page: currentPage,
          limit: DASHBOARD_MENU_LIMIT,
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
  }, [
    today,
    searchQuery,
    category,
    dietaryLabel,
    cafeteriaId,
    mealTime,
    hideAllergyConflicts,
    currentPage,
  ]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const handleMenuServingStatusUpdate = useCallback((event: MenuServingStatusUpdate) => {
    setItems((current) => applyMenuServingStatusUpdate(current, event));
  }, []);

  useMenuServingStatusEvents(handleMenuServingStatusUpdate);

  useEffect(() => {
    let isCurrent = true;

    setIsInsightsLoading(true);
    Promise.all([
      api.get<WeeklyBestItem[]>("/recommendations/weekly-best", {
        query: { limit: 3 },
      }),
      api.get<CafeteriaRankItem[]>("/analytics/cafeteria-ranking", {
        query: { limit: 3 },
      }),
      api.get<Discount[]>("/discounts"),
    ])
      .then(([bestItems, rankings, discountItems]) => {
        if (!isCurrent) return;
        setWeeklyBest(bestItems);
        setCafeteriaRanking(rankings);
        setDiscounts(discountItems);
      })
      .catch(() => {
        if (!isCurrent) return;
        setWeeklyBest([]);
        setCafeteriaRanking([]);
        setDiscounts([]);
      })
      .finally(() => {
        if (isCurrent) setIsInsightsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCurrentPage(1);
    setSearchQuery(searchInput.trim());
  }

  function resetFilters() {
    setCurrentPage(1);
    setSearchInput("");
    setSearchQuery("");
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
    <main className="container max-w-4xl space-y-8 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Today &middot; {today}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Cafeteria menu</h1>
        </div>
        <div className="flex items-center gap-2">
          {!user && (
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link href="/help">
              <CircleHelp className="h-4 w-4" />
              Help
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base">Weekly Best</CardTitle>
              <CardDescription>
                Top meals weighted by rating and verified review volume.
              </CardDescription>
            </div>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isInsightsLoading ? (
              <p className="text-sm text-muted-foreground">Loading recommendations...</p>
            ) : weeklyBest.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recommendations yet.</p>
            ) : (
              <ol className="space-y-3">
                {weeklyBest.map((item, index) => (
                  <li key={item.menuServingId} className="relative flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-muted/60 transition-colors">
                    <Link href={`/menu-servings/${item.menuServingId}`} className="absolute inset-0 rounded-lg" aria-label={item.mealName} />
                    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div className="relative min-w-0 flex-1">
                      <p className="font-medium">{item.mealName}</p>
                      <p className="text-xs text-muted-foreground">{item.cafeteriaName}</p>
                      <Link
                        href={`/menu-servings/${item.menuServingId}/reviews`}
                        className="relative z-10 mt-1 flex items-center gap-1.5 w-fit rounded hover:bg-muted px-0.5"
                      >
                        <span className="text-xs font-medium">{item.averageRating.toFixed(1)}</span>
                        <StarRating rating={item.averageRating} />
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageCircle className="h-3 w-3" />
                          {item.verifiedReviewCount}
                        </span>
                      </Link>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base">Cafeteria ranking</CardTitle>
              <CardDescription>Verified satisfaction by dining hall.</CardDescription>
            </div>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isInsightsLoading ? (
              <p className="text-sm text-muted-foreground">Loading rankings...</p>
            ) : cafeteriaRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ranking data yet.</p>
            ) : (
              <ol className="space-y-3">
                {cafeteriaRanking.map((item) => (
                  <li key={item.cafeteriaId} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">
                        #{item.rank} {item.cafeteriaName}
                      </span>
                      <span className="text-muted-foreground">
                        {item.averageRating.toFixed(1)} / 5
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(item.averageRating / 5, 1) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.verifiedReviewCount} verified reviews
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>

      {discounts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base">Ongoing Promotions</CardTitle>
              <CardDescription>Special prices available right now.</CardDescription>
            </div>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {discounts.map((discount) => (
                <li key={discount.id}>
                  <Link
                    href={discount.menuServingId ? `/menu-servings/${discount.menuServingId}` : `/search?q=${encodeURIComponent(discount.menuName)}`}
                    className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors hover:border-primary/40"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-medium">{discount.menuName}</p>
                      <p className="text-xs text-muted-foreground">
                        {discount.cafeteriaName} &middot; Until{" "}
                        {new Date(discount.validUntil).toLocaleDateString("en", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <span className="shrink-0 text-base font-bold text-primary">
                      {formatPriceKRW(discount.discountedPrice)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Find a meal</CardTitle>
            <CardDescription>
              Search today&apos;s menus by category, cafeteria, or dietary option.
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/search">
              <Filter className="h-4 w-4" />
              Advanced
            </Link>
          </Button>
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
              onClick={() => {
                setCurrentPage(1);
                setCategory("");
              }}
            >
              All
            </Button>
            {CATEGORY_CODES.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={category === value ? "default" : "outline"}
                onClick={() => {
                  setCurrentPage(1);
                  setCategory(value);
                }}
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
                onChange={(event) => {
                  setCurrentPage(1);
                  setCafeteriaId(event.target.value);
                }}
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
                onChange={(event) => {
                  setCurrentPage(1);
                  setMealTime(event.target.value as MealTime | "");
                }}
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
                onChange={(event) => {
                  setCurrentPage(1);
                  setDietaryLabel(event.target.value as DietaryLabelCode | "");
                }}
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
              onChange={(event) => {
                setCurrentPage(1);
                setHideAllergyConflicts(event.target.checked);
              }}
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
            Showing {firstVisibleItem}-{lastVisibleItem} of {total} available menu items
          </p>
          <ul className="grid gap-4 sm:grid-cols-2">
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
          {totalPages > 1 ? (
            <nav
              aria-label="Menu page navigation"
              className="flex flex-wrap items-center justify-center gap-2"
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                aria-label="Previous menu page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {pageNumbers.map((page) => (
                <Button
                  key={page}
                  type="button"
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  className="h-9 min-w-9 px-3"
                  onClick={() => setCurrentPage(page)}
                  aria-current={page === currentPage ? "page" : undefined}
                >
                  {page}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next menu page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </nav>
          ) : null}
        </section>
      )}
    </main>
  );
}

function buildPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}
