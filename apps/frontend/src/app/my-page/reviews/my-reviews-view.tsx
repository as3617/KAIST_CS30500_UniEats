"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiClientError, api } from "@/lib/api";
import type { PaginatedData } from "@/types";
import type { UserReview } from "@/app/api/users/me/reviews/route";

type MyReviewsViewProps = {
  highlightedReviewId?: string;
};

export function MyReviewsView({ highlightedReviewId }: MyReviewsViewProps) {
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError(null);

    api
      .get<PaginatedData<UserReview>>("/users/me/reviews")
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
  }, []);

  return (
    <main className="container max-w-3xl space-y-6 py-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/my-page">
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>
      </Button>

      <header className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">My Page</p>
        <h1 className="text-3xl font-semibold tracking-tight">My Reviews</h1>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your reviews...</p>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8" />
          <p className="text-sm">You haven&apos;t written any reviews yet.</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Browse meals</Link>
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {reviews.length} verified {reviews.length === 1 ? "review" : "reviews"}
          </p>
          <ul className="space-y-4">
            {reviews.map((review) => (
              <li key={review.id} id={`review-${review.id}`}>
                <MyReviewCard
                  review={review}
                  isHighlighted={review.id === highlightedReviewId}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function MyReviewCard({
  review,
  isHighlighted,
}: {
  review: UserReview;
  isHighlighted: boolean;
}) {
  return (
    <Link href={`/menu-servings/${review.menuServingId}`} className="block">
      <Card
        className={`transition-colors hover:border-primary/40 ${
          isHighlighted ? "border-primary bg-primary/5" : ""
        }`}
      >
        <CardHeader className="space-y-2 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{review.mealName}</CardTitle>
              <CardDescription>{review.cafeteriaName}</CardDescription>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {new Date(review.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <StarDisplay value={review.rating} />
            <span className="text-xs text-muted-foreground">
              Taste {review.detailRatings.taste} &middot; Value {review.detailRatings.price} &middot; Portion {review.detailRatings.portion}
            </span>
          </div>
        </CardHeader>
        {(review.content || review.managerReply) ? (
          <CardContent className="space-y-3 pt-0">
            {review.content ? (
              <p className="text-sm">{review.content}</p>
            ) : null}
            {review.managerReply ? (
              <div className="rounded-md border-l-2 border-primary bg-muted/40 px-3 py-2 text-sm">
                <p className="mb-0.5 text-xs font-medium text-primary">Manager reply</p>
                <p className="text-muted-foreground">{review.managerReply.content}</p>
              </div>
            ) : null}
          </CardContent>
        ) : null}
      </Card>
    </Link>
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
