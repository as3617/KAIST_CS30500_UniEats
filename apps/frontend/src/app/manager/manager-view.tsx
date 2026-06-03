"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  MessageSquareReply,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  UtensilsCrossed,
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
import { formatPriceKRW, todayInSeoul } from "@/lib/date";
import {
  applyMenuServingStatusUpdate,
  useMenuServingStatusEvents,
} from "@/lib/menu-serving-events";
import type { MenuServingStatusUpdate } from "@/lib/menu-serving-events";
import {
  ALLERGY_CODES,
  ALLERGY_LABELS,
  CATEGORY_CODES,
  CATEGORY_LABELS,
  DIETARY_LABEL_CODES,
  DIETARY_LABELS,
  MEAL_TIMES,
  MEAL_TIME_LABELS,
  MENU_SERVING_STATUSES,
} from "@/types";
import type {
  AllergyCode,
  Cafeteria,
  CategoryCode,
  DietaryLabelCode,
  Meal,
  MealTime,
  MenuServing,
  MenuServingStatus,
  PaginatedData,
  Review,
  User,
} from "@/types";

type ManagerReview = Review & {
  mealName: string;
  cafeteriaName: string;
};

type ManagedCafeteria = {
  cafeteriaId: string;
  name: string;
  permissions?: string[];
};

type MenuCreateForm = {
  name: string;
  description: string;
  category: CategoryCode;
  ingredients: string;
  allergens: AllergyCode[];
  dietaryLabels: DietaryLabelCode[];
  calories: string;
  carbohydrate: string;
  protein: string;
  fat: string;
  sodium: string;
  date: string;
  mealTime: MealTime;
  price: string;
  stock: string;
  status: MenuServingStatus;
};

function createInitialMenuForm(date: string): MenuCreateForm {
  return {
    name: "",
    description: "",
    category: "KOREAN",
    ingredients: "",
    allergens: [],
    dietaryLabels: [],
    calories: "",
    carbohydrate: "",
    protein: "",
    fat: "",
    sodium: "",
    date,
    mealTime: "LUNCH",
    price: "",
    stock: "",
    status: "AVAILABLE",
  };
}

export function ManagerView() {
  const today = useMemo(() => todayInSeoul(), []);
  const [user, setUser] = useState<Pick<User, "nickname" | "role"> | null>(null);
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [selectedCafeteriaId, setSelectedCafeteriaId] = useState("");
  const [servings, setServings] = useState<MenuServing[]>([]);
  const [reviews, setReviews] = useState<ManagerReview[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [menuForm, setMenuForm] = useState<MenuCreateForm>(() =>
    createInitialMenuForm(today),
  );
  const [isCafeteriaLocked, setIsCafeteriaLocked] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedCafeteria = cafeterias.find(
    (cafeteria) => cafeteria.id === selectedCafeteriaId,
  );
  const stats = useMemo(() => buildStats(servings, reviews), [servings, reviews]);

  useEffect(() => {
    let isCurrent = true;
    const currentUser = authStorage.getUser();
    setUser(currentUser);

    async function loadCafeteriaOptions() {
      if (!currentUser) {
        if (!isCurrent) return;
        setCafeterias([]);
        setSelectedCafeteriaId("");
        setIsCafeteriaLocked(true);
        setIsLoading(false);
        return;
      }

      try {
        if (currentUser.role === "MANAGER") {
          const managed = await api.get<ManagedCafeteria | null>(
            "/users/me/managed-cafeteria",
          );
          if (!isCurrent) return;
          if (!managed) {
            setCafeterias([]);
            setSelectedCafeteriaId("");
            setIsCafeteriaLocked(true);
            setError("No cafeteria is assigned to this manager account.");
            setIsLoading(false);
            return;
          }
          setCafeterias([managedCafeteriaToOption(managed)]);
          setSelectedCafeteriaId(managed.cafeteriaId);
          setIsCafeteriaLocked(true);
          return;
        }

        if (currentUser.role === "ADMIN") {
          const data = await api.get<Cafeteria[]>("/cafeterias");
          if (!isCurrent) return;
          setCafeterias(data);
          setSelectedCafeteriaId(data[0]?.id ?? "");
          setIsCafeteriaLocked(false);
          if (data.length === 0) {
            setIsLoading(false);
          }
          return;
        }

        if (!isCurrent) return;
        setCafeterias([]);
        setSelectedCafeteriaId("");
        setIsCafeteriaLocked(true);
        setError("Manager or admin account required.");
        setIsLoading(false);
      } catch (err) {
        if (!isCurrent) return;
        setError(err instanceof ApiClientError ? err.message : "Failed to load cafeterias");
        setIsLoading(false);
      }
    }

    loadCafeteriaOptions();

    return () => {
      isCurrent = false;
    };
  }, []);

  const fetchManagerData = useCallback(async () => {
    if (!selectedCafeteriaId) {
      setServings([]);
      setReviews([]);
      setReplyDrafts({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const menuData = await api.get<PaginatedData<MenuServing>>("/menu-servings", {
        query: {
          date: today,
          cafeteriaId: selectedCafeteriaId,
          limit: 50,
        },
      });

      const reviewPages = await Promise.all(
        menuData.items.map((serving) =>
          api.get<PaginatedData<Review>>(`/menu-servings/${serving.id}/reviews`),
        ),
      );
      const reviewItems = reviewPages.flatMap((page) => page.items);
      const servingById = new Map(menuData.items.map((serving) => [serving.id, serving]));
      const managerReviews = reviewItems.map((review) => {
        const serving = servingById.get(review.menuServingId);
        return {
          ...review,
          mealName: serving?.meal.name ?? "Unknown meal",
          cafeteriaName: serving?.cafeteria.name ?? selectedCafeteria?.name ?? "Cafeteria",
        };
      });

      setServings(menuData.items);
      setReviews(managerReviews);
      setReplyDrafts(
        Object.fromEntries(
          managerReviews.map((review) => [
            review.id,
            review.managerReply?.content ?? "",
          ]),
        ),
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load manager data");
    } finally {
      setIsLoading(false);
    }
  }, [selectedCafeteria?.name, selectedCafeteriaId, today]);

  useEffect(() => {
    fetchManagerData();
  }, [fetchManagerData]);

  const handleMenuServingStatusUpdate = useCallback((event: MenuServingStatusUpdate) => {
    setServings((current) => applyMenuServingStatusUpdate(current, event));
  }, []);

  useMenuServingStatusEvents(handleMenuServingStatusUpdate);

  async function updateServingStatus(
    menuServingId: string,
    status: MenuServingStatus,
  ) {
    setIsSaving(menuServingId);
    setError(null);
    setSuccess(null);

    try {
      const updated = await api.patch<MenuServing>(
        `/menu-servings/${menuServingId}/status`,
        { status },
      );
      setServings((current) =>
        current.map((serving) => (serving.id === menuServingId ? updated : serving)),
      );
      setSuccess(`Menu status changed to ${status === "SOLD_OUT" ? "sold out" : "available"}.`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update menu status");
    } finally {
      setIsSaving(null);
    }
  }

  async function saveReply(reviewId: string) {
    const content = replyDrafts[reviewId]?.trim() ?? "";
    if (!content) return;

    setIsSaving(reviewId);
    setError(null);
    setSuccess(null);

    try {
      const updated = await api.post<Review>(`/reviews/${reviewId}/reply`, {
        content,
      });
      setReviews((current) =>
        current.map((review) =>
          review.id === reviewId ? { ...review, managerReply: updated.managerReply } : review,
        ),
      );
      setSuccess("Manager reply saved.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save reply");
    } finally {
      setIsSaving(null);
    }
  }

  async function createMenuServing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCafeteriaId) return;

    const price = Number(menuForm.price);
    if (!Number.isFinite(price) || price < 0) {
      setError("Price must be a non-negative number.");
      return;
    }

    const stock = menuForm.stock.trim() ? Number(menuForm.stock) : undefined;
    if (
      stock !== undefined &&
      (!Number.isInteger(stock) || stock < 0)
    ) {
      setError("Stock must be a non-negative whole number.");
      return;
    }

    setIsSaving("create-menu");
    setError(null);
    setSuccess(null);

    try {
      const serving = await api.post<MenuServing>("/menu-servings/with-meal", {
        meal: {
          name: menuForm.name,
          description: menuForm.description || undefined,
          category: menuForm.category,
          ingredients: parseCommaList(menuForm.ingredients),
          allergens: menuForm.allergens,
          dietaryLabels: menuForm.dietaryLabels,
          nutrition: buildNutrition(menuForm),
        },
        cafeteriaId: selectedCafeteriaId,
        date: menuForm.date,
        mealTime: menuForm.mealTime,
        price,
        stock,
        status: menuForm.status,
      });

      if (
        serving.cafeteria.id === selectedCafeteriaId &&
        serving.date === today
      ) {
        setServings((current) => [serving, ...current]);
      }
      setMenuForm((current) => ({
        ...createInitialMenuForm(today),
        date: current.date,
        mealTime: current.mealTime,
        status: current.status,
      }));
      setSuccess(`${serving.meal.name} has been added to the menu.`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create menu");
    } finally {
      setIsSaving(null);
    }
  }

  return (
    <main className="container max-w-6xl space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Manager</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Cafeteria operations
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Update today&apos;s menu availability, monitor verified feedback, and
            respond to diners from one dashboard.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={fetchManagerData}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </header>

      {user?.role !== "MANAGER" && user?.role !== "ADMIN" ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex gap-3 p-4 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Mock manager mode is open for frontend development. The real backend
              should enforce MANAGER or ADMIN permissions before these actions run.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-2">
            <Label htmlFor="manager-cafeteria">Managed cafeteria</Label>
            <select
              id="manager-cafeteria"
              value={selectedCafeteriaId}
              onChange={(event) => setSelectedCafeteriaId(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={isCafeteriaLocked}
            >
              {cafeterias.map((cafeteria) => (
                <option key={cafeteria.id} value={cafeteria.id}>
                  {cafeteria.name}
                </option>
              ))}
            </select>
          </div>
          <MetricCard label="Menus today" value={String(stats.totalMenus)} />
          <MetricCard label="Sold out" value={String(stats.soldOutMenus)} />
          <MetricCard label="Avg rating" value={stats.averageRating} />
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

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading manager dashboard...</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="space-y-4 lg:col-span-2">
            <SectionHeader
              icon={<PlusCircle className="h-4 w-4" />}
              title="Register menu"
              description="Create a meal record and schedule it for a cafeteria service."
            />
            <MenuCreateFormCard
              form={menuForm}
              cafeterias={cafeterias}
              cafeteriaId={selectedCafeteriaId}
              isCafeteriaLocked={isCafeteriaLocked}
              isSaving={isSaving === "create-menu"}
              onChangeForm={setMenuForm}
              onChangeCafeteria={setSelectedCafeteriaId}
              onSubmit={createMenuServing}
            />
          </section>

          <section className="space-y-4">
            <SectionHeader
              icon={<UtensilsCrossed className="h-4 w-4" />}
              title="Today's menus"
              description={`${selectedCafeteria?.name ?? "Cafeteria"} - ${today}`}
            />
            {servings.length === 0 ? (
              <EmptyPanel message="No menus scheduled for this cafeteria today." />
            ) : (
              <ul className="space-y-3">
                {servings.map((serving) => (
                  <li key={serving.id}>
                    <MenuStatusCard
                      serving={serving}
                      isSaving={isSaving === serving.id}
                      onChangeStatus={updateServingStatus}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            <SectionHeader
              icon={<MessageSquareReply className="h-4 w-4" />}
              title="Verified feedback"
              description={`${reviews.length} review${reviews.length === 1 ? "" : "s"} to monitor`}
            />
            {reviews.length === 0 ? (
              <EmptyPanel message="No verified reviews for today's menus yet." />
            ) : (
              <ul className="space-y-3">
                {reviews.map((review) => (
                  <li key={review.id}>
                    <ReviewReplyCard
                      review={review}
                      draft={replyDrafts[review.id] ?? ""}
                      isSaving={isSaving === review.id}
                      onChangeDraft={(value) =>
                        setReplyDrafts((current) => ({
                          ...current,
                          [review.id]: value,
                        }))
                      }
                      onSave={() => saveReply(review.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function MenuCreateFormCard({
  form,
  cafeterias,
  cafeteriaId,
  isCafeteriaLocked,
  isSaving,
  onChangeForm,
  onChangeCafeteria,
  onSubmit,
}: {
  form: MenuCreateForm;
  cafeterias: Cafeteria[];
  cafeteriaId: string;
  isCafeteriaLocked: boolean;
  isSaving: boolean;
  onChangeForm: React.Dispatch<React.SetStateAction<MenuCreateForm>>;
  onChangeCafeteria: (cafeteriaId: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-5 p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="new-meal-name">Meal name</Label>
              <Input
                id="new-meal-name"
                value={form.name}
                onChange={(event) =>
                  onChangeForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Spicy tofu stew"
                required
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-meal-category">Cuisine</Label>
              <select
                id="new-meal-category"
                value={form.category}
                onChange={(event) =>
                  onChangeForm((current) => ({
                    ...current,
                    category: event.target.value as CategoryCode,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={isSaving}
              >
                {CATEGORY_CODES.map((value) => (
                  <option key={value} value={value}>
                    {CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-meal-description">Description</Label>
            <textarea
              id="new-meal-description"
              value={form.description}
              onChange={(event) =>
                onChangeForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Short menu note for diners"
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="space-y-2">
              <Label htmlFor="new-menu-cafeteria">Cafeteria</Label>
              <select
                id="new-menu-cafeteria"
                value={cafeteriaId}
                onChange={(event) => onChangeCafeteria(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={isSaving || isCafeteriaLocked}
                required
              >
                {cafeterias.map((cafeteria) => (
                  <option key={cafeteria.id} value={cafeteria.id}>
                    {cafeteria.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-menu-date">Date</Label>
              <Input
                id="new-menu-date"
                type="date"
                value={form.date}
                onChange={(event) =>
                  onChangeForm((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
                required
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-menu-time">Meal time</Label>
              <select
                id="new-menu-time"
                value={form.mealTime}
                onChange={(event) =>
                  onChangeForm((current) => ({
                    ...current,
                    mealTime: event.target.value as MealTime,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={isSaving}
              >
                {MEAL_TIMES.map((value) => (
                  <option key={value} value={value}>
                    {MEAL_TIME_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-menu-status">Status</Label>
              <select
                id="new-menu-status"
                value={form.status}
                onChange={(event) =>
                  onChangeForm((current) => ({
                    ...current,
                    status: event.target.value as MenuServingStatus,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={isSaving}
              >
                {MENU_SERVING_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value === "SOLD_OUT" ? "Sold out" : value === "HIDDEN" ? "Hidden" : "Available"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_2fr]">
            <div className="space-y-2">
              <Label htmlFor="new-menu-price">Price</Label>
              <Input
                id="new-menu-price"
                type="number"
                min={0}
                step={100}
                value={form.price}
                onChange={(event) =>
                  onChangeForm((current) => ({
                    ...current,
                    price: event.target.value,
                  }))
                }
                placeholder="5200"
                required
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-menu-stock">Stock</Label>
              <Input
                id="new-menu-stock"
                type="number"
                min={0}
                step={1}
                value={form.stock}
                onChange={(event) =>
                  onChangeForm((current) => ({
                    ...current,
                    stock: event.target.value,
                  }))
                }
                placeholder="100"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-meal-ingredients">Ingredients</Label>
              <Input
                id="new-meal-ingredients"
                value={form.ingredients}
                onChange={(event) =>
                  onChangeForm((current) => ({
                    ...current,
                    ingredients: event.target.value,
                  }))
                }
                placeholder="tofu, kimchi, rice"
                required
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <CheckboxGrid
              label="Allergens"
              values={ALLERGY_CODES}
              selected={form.allergens}
              labels={ALLERGY_LABELS}
              disabled={isSaving}
              onChange={(allergens) =>
                onChangeForm((current) => ({ ...current, allergens }))
              }
            />
            <CheckboxGrid
              label="Dietary labels"
              values={DIETARY_LABEL_CODES}
              selected={form.dietaryLabels}
              labels={DIETARY_LABELS}
              disabled={isSaving}
              onChange={(dietaryLabels) =>
                onChangeForm((current) => ({ ...current, dietaryLabels }))
              }
            />
          </div>

          <div className="space-y-3">
            <Label>Nutrition</Label>
            <div className="grid gap-3 sm:grid-cols-5">
              <NutritionInput
                label="Calories"
                field="calories"
                value={form.calories}
                disabled={isSaving}
                onChangeForm={onChangeForm}
              />
              <NutritionInput
                label="Carbs"
                field="carbohydrate"
                value={form.carbohydrate}
                disabled={isSaving}
                onChangeForm={onChangeForm}
              />
              <NutritionInput
                label="Protein"
                field="protein"
                value={form.protein}
                disabled={isSaving}
                onChangeForm={onChangeForm}
              />
              <NutritionInput
                label="Fat"
                field="fat"
                value={form.fat}
                disabled={isSaving}
                onChangeForm={onChangeForm}
              />
              <NutritionInput
                label="Sodium"
                field="sodium"
                value={form.sodium}
                disabled={isSaving}
                onChangeForm={onChangeForm}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving || !cafeteriaId}>
              <PlusCircle className="h-4 w-4" />
              {isSaving ? "Registering..." : "Register menu"}
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}

function CheckboxGrid<T extends string>({
  label,
  values,
  selected,
  labels,
  disabled,
  onChange,
}: {
  label: string;
  values: readonly T[];
  selected: T[];
  labels: Record<T, string>;
  disabled: boolean;
  onChange: (values: T[]) => void;
}) {
  function toggle(value: T, checked: boolean) {
    onChange(
      checked
        ? [...selected, value]
        : selected.filter((selectedValue) => selectedValue !== value),
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
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
    </div>
  );
}

function NutritionInput({
  label,
  field,
  value,
  disabled,
  onChangeForm,
}: {
  label: string;
  field: "calories" | "carbohydrate" | "protein" | "fat" | "sodium";
  value: string;
  disabled: boolean;
  onChangeForm: React.Dispatch<React.SetStateAction<MenuCreateForm>>;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`nutrition-${field}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`nutrition-${field}`}
        type="number"
        min={0}
        value={value}
        onChange={(event) =>
          onChangeForm((current) => ({
            ...current,
            [field]: event.target.value,
          }))
        }
        disabled={disabled}
      />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          {icon}
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function MenuStatusCard({
  serving,
  isSaving,
  onChangeStatus,
}: {
  serving: MenuServing;
  isSaving: boolean;
  onChangeStatus: (menuServingId: string, status: MenuServingStatus) => void;
}) {
  const isSoldOut = serving.status === "SOLD_OUT";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{serving.meal.name}</CardTitle>
            <CardDescription>
              {MEAL_TIME_LABELS[serving.mealTime]} &middot; {formatPriceKRW(serving.price)}
            </CardDescription>
          </div>
          <Badge variant={isSoldOut ? "destructive" : "secondary"}>
            {isSoldOut ? "Sold out" : "Available"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0">
        <p className="text-sm text-muted-foreground">
          {serving.averageRating.toFixed(1)} / 5 from {serving.verifiedReviewCount} verified
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={isSoldOut ? "outline" : "default"}
            disabled={isSaving || !isSoldOut}
            onClick={() => onChangeStatus(serving.id, "AVAILABLE")}
          >
            <CheckCircle2 className="h-4 w-4" />
            Available
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isSoldOut ? "default" : "outline"}
            disabled={isSaving || isSoldOut}
            onClick={() => onChangeStatus(serving.id, "SOLD_OUT")}
          >
            Sold out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewReplyCard({
  review,
  draft,
  isSaving,
  onChangeDraft,
  onSave,
}: {
  review: ManagerReview;
  draft: string;
  isSaving: boolean;
  onChangeDraft: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <Card>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{review.mealName}</CardTitle>
            <CardDescription>
              {review.rating} / 5 &middot; Taste {review.detailRatings.taste} - Value{" "}
              {review.detailRatings.price} - Portion {review.detailRatings.portion}
            </CardDescription>
          </div>
          <Badge variant={review.managerReply ? "secondary" : "outline"}>
            {review.managerReply ? "Replied" : "Needs reply"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {review.content ? <p className="text-sm">{review.content}</p> : null}
        <div className="space-y-2">
          <Label htmlFor={`reply-${review.id}`}>Manager reply</Label>
          <textarea
            id={`reply-${review.id}`}
            value={draft}
            onChange={(event) => onChangeDraft(event.target.value)}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Write an official response..."
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/menu-servings/${review.menuServingId}/reviews`}
            className="text-sm text-primary hover:underline"
          >
            Open review thread
          </Link>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={isSaving || draft.trim().length < 2}
          >
            {isSaving ? "Saving..." : "Save reply"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-10 text-center">
      <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function buildStats(servings: MenuServing[], reviews: ManagerReview[]) {
  const soldOutMenus = servings.filter((serving) => serving.status === "SOLD_OUT").length;
  const average =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

  return {
    totalMenus: servings.length,
    soldOutMenus,
    averageRating: reviews.length > 0 ? average.toFixed(1) : "-",
  };
}

function managedCafeteriaToOption(managed: ManagedCafeteria): Cafeteria {
  return {
    id: managed.cafeteriaId,
    name: managed.name,
    location: {},
    openingHours: {},
    isActive: true,
  };
}

function parseCommaList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function buildNutrition(form: MenuCreateForm) {
  const nutrition: Meal["nutrition"] = {};
  for (const field of ["calories", "carbohydrate", "protein", "fat", "sodium"] as const) {
    const value = form[field].trim() ? Number(form[field]) : undefined;
    if (value !== undefined && Number.isFinite(value)) {
      nutrition[field] = value;
    }
  }
  return nutrition;
}
