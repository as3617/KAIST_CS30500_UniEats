"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiClientError, api } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import type { PaginatedData, Review } from "@/types";

type ReviewListViewProps = {
  menuServingId: string;
};

export function ReviewListView({ menuServingId }: ReviewListViewProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!authStorage.getUser());
  }, []);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError(null);

    api
      .get<PaginatedData<Review>>(`/menu-servings/${menuServingId}/reviews`)
      .then((data) => {
        if (isCurrent) setReviews(data.items);
      })
      .catch((err) => {
        if (!isCurrent) return;
        setError(err instanceof ApiClientError ? err.message : "Failed to load reviews");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [menuServingId]);

  return (
    <main className="container max-w-3xl space-y-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/menu-servings/${menuServingId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to meal
          </Link>
        </Button>
        {isLoggedIn && (
          <Button asChild size="sm">
            <Link href={`/menu-servings/${menuServingId}/reviews/new`}>
              Write a Review
            </Link>
          </Button>
        )}
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>

      {!isLoggedIn && (
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="underline">Sign in</Link> to write a verified review.
        </p>
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8" />
          <p className="text-sm">No reviews yet. Be the first to review!</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <Card>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <StarDisplay value={review.rating} />
            <span className="text-sm font-medium">{review.rating} / 5</span>
          </div>
          <div className="flex items-center gap-2">
            {review.isVerified && (
              <Badge variant="secondary" className="text-xs">Verified</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(review.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {review.reviewerDisplayName ?? "Masked reviewer"}
        </p>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Taste: {review.detailRatings.taste}/5</span>
          <span>Value: {review.detailRatings.price}/5</span>
          <span>Portion: {review.detailRatings.portion}/5</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {review.content ? (
          <p className="text-sm">{review.content}</p>
        ) : null}
        {review.managerReply ? (
          <div className="rounded-md border-l-2 border-primary bg-muted/40 px-3 py-2 text-sm">
            <CardTitle className="mb-1 text-xs text-primary">Manager reply</CardTitle>
            <p className="text-muted-foreground">{review.managerReply.content}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StarDisplay({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <span className="text-yellow-400 leading-none" aria-label={`${value} stars`}>
      {"★".repeat(filled)}
      <span className="text-muted-foreground/40">{"★".repeat(5 - filled)}</span>
    </span>
  );
}
