"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  MessageSquareReply,
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
import { Label } from "@/components/ui/label";
import { ApiClientError, api } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import { formatPriceKRW, todayInSeoul } from "@/lib/date";
import { MEAL_TIME_LABELS } from "@/types";
import type {
  Cafeteria,
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

export function ManagerView() {
  const today = useMemo(() => todayInSeoul(), []);
  const [user, setUser] = useState<Pick<User, "nickname" | "role"> | null>(null);
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [selectedCafeteriaId, setSelectedCafeteriaId] = useState("");
  const [servings, setServings] = useState<MenuServing[]>([]);
  const [reviews, setReviews] = useState<ManagerReview[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedCafeteria = cafeterias.find(
    (cafeteria) => cafeteria.id === selectedCafeteriaId,
  );
  const stats = useMemo(() => buildStats(servings, reviews), [servings, reviews]);

  useEffect(() => {
    setUser(authStorage.getUser());
  }, []);

  useEffect(() => {
    let isCurrent = true;

    api
      .get<Cafeteria[]>("/cafeterias")
      .then((data) => {
        if (!isCurrent) return;
        setCafeterias(data);
        setSelectedCafeteriaId(data[0]?.id ?? "");
      })
      .catch((err) => {
        if (!isCurrent) return;
        setError(err instanceof ApiClientError ? err.message : "Failed to load cafeterias");
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const fetchManagerData = useCallback(async () => {
    if (!selectedCafeteriaId) return;

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
