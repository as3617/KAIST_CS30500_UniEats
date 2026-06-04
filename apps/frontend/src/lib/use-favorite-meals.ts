"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiClientError, api } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import type { FavoriteMeal } from "@/types";

export function useFavoriteMeals(enabled = true) {
  const [favoriteMeals, setFavoriteMeals] = useState<FavoriteMeal[]>([]);
  const [favoriteMealIds, setFavoriteMealIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingMealIds, setPendingMealIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !authStorage.getAccessToken()) {
      setFavoriteMeals([]);
      setFavoriteMealIds(new Set());
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const favorites = await api.get<FavoriteMeal[]>("/users/me/favorites");
      setFavoriteMeals(favorites);
      setFavoriteMealIds(new Set(favorites.map((favorite) => favorite.mealId)));
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setFavoriteMeals([]);
        setFavoriteMealIds(new Set());
        setError(null);
      } else {
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load favorite meals.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleFavorite = useCallback(
    async (mealId: string) => {
      if (!authStorage.getAccessToken()) {
        throw new ApiClientError("UNAUTHORIZED", "Sign in to save favorites.", 401);
      }

      const wasFavorite = favoriteMealIds.has(mealId);
      setError(null);
      setPendingMealIds((current) => {
        const next = new Set(current);
        next.add(mealId);
        return next;
      });
      setFavoriteMealIds((current) => {
        const next = new Set(current);
        if (wasFavorite) {
          next.delete(mealId);
        } else {
          next.add(mealId);
        }
        return next;
      });
      if (wasFavorite) {
        setFavoriteMeals((current) =>
          current.filter((favorite) => favorite.mealId !== mealId),
        );
      }

      try {
        if (wasFavorite) {
          await api.delete<Record<string, never>>(`/users/me/favorites/${mealId}`);
        } else {
          const created = await api.post<FavoriteMeal>("/users/me/favorites", {
            mealId,
          });
          setFavoriteMeals((current) =>
            current.some((favorite) => favorite.mealId === mealId)
              ? current
              : [created, ...current],
          );
        }
      } catch (err) {
        await refresh();
        const message =
          err instanceof ApiClientError
            ? err.message
            : "Failed to update favorite meal.";
        setError(message);
        throw err;
      } finally {
        setPendingMealIds((current) => {
          const next = new Set(current);
          next.delete(mealId);
          return next;
        });
      }
    },
    [favoriteMealIds, refresh],
  );

  return {
    favoriteMeals,
    favoriteMealIds,
    pendingMealIds,
    isLoading,
    error,
    refresh,
    toggleFavorite,
  };
}
