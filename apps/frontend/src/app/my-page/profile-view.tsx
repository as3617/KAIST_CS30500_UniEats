"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  ChevronRight,
  Heart,
  Leaf,
  LogOut,
  Save,
  ShieldAlert,
  Star,
  Trash2,
  Utensils,
} from "lucide-react";

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
import { useFavoriteMeals } from "@/lib/use-favorite-meals";
import {
  ALLERGY_CODES,
  ALLERGY_LABELS,
  CATEGORY_LABELS,
  DIETARY_LABEL_CODES,
  DIETARY_LABELS,
} from "@/types";
import type {
  AllergyCode,
  DietaryLabelCode,
  DietaryProfile,
  FavoriteMeal,
  UserProfile,
} from "@/types";

type ProfileForm = {
  nickname: string;
  allergies: AllergyCode[];
  dietaryLabels: DietaryLabelCode[];
  preferredIngredients: string;
  dislikedIngredients: string;
};

export function ProfileView() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const {
    favoriteMeals,
    pendingMealIds: pendingFavoriteMealIds,
    isLoading: isFavoritesLoading,
    error: favoritesError,
    toggleFavorite,
  } = useFavoriteMeals(Boolean(profile));

  useEffect(() => {
    let isCurrent = true;

    api
      .get<UserProfile>("/users/me")
      .then((data) => {
        if (!isCurrent) return;
        setProfile(data);
        setForm(toForm(data));
      })
      .catch((err) => {
        if (!isCurrent) return;
        setErrorCode(err instanceof ApiClientError ? err.code : null);
        setError(toMessage(err, "Failed to load your profile."));
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;

    setError(null);
    setErrorCode(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const updated = await api.patch<UserProfile>("/users/me", {
        nickname: form.nickname,
        dietaryProfile: toDietaryProfile(form),
      });
      setProfile(updated);
      setForm(toForm(updated));

      const signedInUser = authStorage.getUser();
      if (signedInUser) {
        authStorage.setUser({ ...signedInUser, nickname: updated.nickname });
      }
      setSuccess("Your dietary profile has been updated.");
    } catch (err) {
      setErrorCode(err instanceof ApiClientError ? err.code : null);
      setError(toMessage(err, "Failed to update your profile."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveFavorite(mealId: string) {
    try {
      await toggleFavorite(mealId);
    } catch (err) {
      setError(toMessage(err, "Failed to update favorite meals."));
    }
  }

  if (isLoading) {
    return (
      <main className="container max-w-3xl py-8">
        <p className="text-sm text-muted-foreground">Loading your profile...</p>
      </main>
    );
  }

  if (!profile || !form) {
    return (
      <main className="container max-w-3xl space-y-5 py-8">
        <BackToDashboard />
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error ?? "Your profile is unavailable."}
        </p>
        {errorCode === "FORBIDDEN" ? (
          <p className="text-sm text-muted-foreground">
            Verify your KAIST email before managing personal dietary settings.
          </p>
        ) : (
          <Button asChild>
            <Link href="/login">Sign in to continue</Link>
          </Button>
        )}
      </main>
    );
  }

  return (
    <main className="container max-w-3xl space-y-6 py-8">
      <BackToDashboard />

      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">My Page</p>
          <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        </div>
        <SignOutButton />
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{profile.nickname}</CardTitle>
          <CardDescription>{profile.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {(profile.role === "MANAGER" || profile.role === "ADMIN") && (
            <Link
              href="/manager"
              className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:border-primary/60 hover:bg-primary/5"
            >
              <BriefcaseBusiness className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Manager Dashboard</p>
                <p className="text-xs text-muted-foreground">
                  {profile.role === "ADMIN" ? "Admin" : "Cafeteria manager"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          )}
          <Link
            href="/my-page/reviews"
            className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:border-primary/60 hover:bg-primary/5"
          >
            <Star className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">My Reviews</p>
              <p className="text-xs text-muted-foreground">
                {profile.reviewStats.verifiedReviewCount} verified
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      <FavoriteMealsCard
        favorites={favoriteMeals}
        isLoading={isFavoritesLoading}
        error={favoritesError}
        pendingMealIds={pendingFavoriteMealIds}
        onRemove={handleRemoveFavorite}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-sm space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                value={form.nickname}
                onChange={(event) =>
                  setForm({ ...form, nickname: event.target.value })
                }
                minLength={2}
                maxLength={24}
                required
                disabled={isSaving}
              />
            </div>
          </CardContent>
        </Card>

        <h2 className="text-lg font-semibold tracking-tight">Dietary profile</h2>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Allergy warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CheckboxGrid
              values={ALLERGY_CODES}
              selected={form.allergies}
              labels={ALLERGY_LABELS}
              onChange={(allergies) => setForm({ ...form, allergies })}
              disabled={isSaving}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Leaf className="h-4 w-4 text-green-500" />
              Dietary options
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CheckboxGrid
              values={DIETARY_LABEL_CODES}
              selected={form.dietaryLabels}
              labels={DIETARY_LABELS}
              onChange={(dietaryLabels) => setForm({ ...form, dietaryLabels })}
              disabled={isSaving}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Utensils className="h-4 w-4 text-muted-foreground" />
              Ingredient preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="preferred-ingredients">Preferred ingredients</Label>
              <Input
                id="preferred-ingredients"
                value={form.preferredIngredients}
                onChange={(event) =>
                  setForm({ ...form, preferredIngredients: event.target.value })
                }
                placeholder="chicken, tofu"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disliked-ingredients">Disliked ingredients</Label>
              <Input
                id="disliked-ingredients"
                value={form.dislikedIngredients}
                onChange={(event) =>
                  setForm({ ...form, dislikedIngredients: event.target.value })
                }
                placeholder="onion, cilantro"
                disabled={isSaving}
              />
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
        {success ? (
          <p
            role="status"
            className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary"
          >
            {success}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save profile"}
          </Button>
        </div>
      </form>

    </main>
  );
}

function SignOutButton() {
  const router = useRouter();

  function handleSignOut() {
    authStorage.clear();
    router.push("/login");
  }

  return (
    <div className="flex justify-center pb-4">
      <Button variant="outline" size="sm" onClick={handleSignOut}>
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}

function FavoriteMealsCard({
  favorites,
  isLoading,
  error,
  pendingMealIds,
  onRemove,
}: {
  favorites: FavoriteMeal[];
  isLoading: boolean;
  error: string | null;
  pendingMealIds: Set<string>;
  onRemove: (mealId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className="h-4 w-4 text-primary" />
          Favorite meals
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading favorite meals...</p>
        ) : favorites.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">
            No favorite meals yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {favorites.map((favorite) => {
              const mealName = favorite.meal?.name ?? "Saved meal";
              return (
                <li key={favorite.mealId} className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:border-primary/40">
                  <Link
                    href={`/search?q=${encodeURIComponent(mealName)}`}
                    className="min-w-0 flex-1 space-y-1"
                  >
                    <p className="font-medium">{mealName}</p>
                    <p className="text-xs text-muted-foreground">
                      {favorite.meal
                        ? CATEGORY_LABELS[favorite.meal.category]
                        : "Meal"}
                      {favorite.createdAt
                        ? ` · Saved ${formatFavoriteDate(favorite.createdAt)}`
                        : ""}
                    </p>
                    {favorite.meal?.dietaryLabels.length ? (
                      <div className="flex flex-wrap gap-1">
                        {favorite.meal.dietaryLabels.map((label) => (
                          <Badge key={label} variant="outline" className="text-xs">
                            {DIETARY_LABELS[label]}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Remove ${mealName} from favorites`}
                    disabled={pendingMealIds.has(favorite.mealId)}
                    onClick={() => onRemove(favorite.mealId)}
                    className="shrink-0 text-muted-foreground hover:text-destructive hover:border-destructive/50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function BackToDashboard() {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/dashboard">
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>
    </Button>
  );
}

function CheckboxGrid<T extends string>({
  values,
  selected,
  labels,
  onChange,
  disabled,
}: {
  values: readonly T[];
  selected: T[];
  labels: Record<T, string>;
  onChange: (values: T[]) => void;
  disabled: boolean;
}) {
  function toggle(value: T, checked: boolean) {
    onChange(
      checked
        ? [...selected, value]
        : selected.filter((selectedValue) => selectedValue !== value),
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {values.map((value) => (
        <label
          key={value}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <input
            type="checkbox"
            checked={selected.includes(value)}
            onChange={(event) => toggle(value, event.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-input"
          />
          {labels[value]}
        </label>
      ))}
    </div>
  );
}

function toForm(profile: UserProfile): ProfileForm {
  return {
    nickname: profile.nickname,
    allergies: profile.dietaryProfile.allergies,
    dietaryLabels: profile.dietaryProfile.dietaryLabels,
    preferredIngredients: profile.dietaryProfile.preferredIngredients.join(", "),
    dislikedIngredients: profile.dietaryProfile.dislikedIngredients.join(", "),
  };
}

function toDietaryProfile(form: ProfileForm): DietaryProfile {
  return {
    allergies: form.allergies,
    dietaryLabels: form.dietaryLabels,
    preferredIngredients: parseIngredients(form.preferredIngredients),
    dislikedIngredients: parseIngredients(form.dislikedIngredients),
  };
}

function parseIngredients(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function formatFavoriteDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function toMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}
