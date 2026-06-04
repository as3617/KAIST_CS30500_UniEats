"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Loader2,
  ReceiptText,
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
import { ApiClientError, api } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import { formatPriceKRW } from "@/lib/date";
import type { Receipt } from "@/types";

type ReceiptDetailViewProps = {
  receiptId: string;
};

export function ReceiptDetailView({ receiptId }: ReceiptDetailViewProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = authStorage.getUser();
    setIsLoggedIn(Boolean(user));
    if (!user) {
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    setIsLoading(true);
    setError(null);

    api
      .get<Receipt>(`/receipts/${receiptId}`)
      .then((data) => {
        if (isCurrent) setReceipt(data);
      })
      .catch((err) => {
        if (!isCurrent) return;
        setError(err instanceof ApiClientError ? err.message : "Failed to load receipt");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [receiptId]);

  if (!isLoggedIn) {
    return (
      <main className="container max-w-3xl space-y-6 py-8">
        <BackButton />
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Receipt details are available after signing in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="container max-w-3xl py-8">
        <p className="text-sm text-muted-foreground">Loading receipt...</p>
      </main>
    );
  }

  if (error || !receipt) {
    return (
      <main className="container max-w-3xl space-y-4 py-8">
        <BackButton />
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error ?? "Receipt is unavailable."}
        </p>
      </main>
    );
  }

  const StatusIcon = receiptStatusIcon(receipt.status);
  const statusVariant = receipt.status === "REJECTED" ? "destructive" : "secondary";

  return (
    <main className="container max-w-3xl space-y-6 py-8">
      <BackButton />

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardDescription>Receipt</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <ReceiptText className="h-5 w-5" />
                OCR status
              </CardTitle>
            </div>
            <Badge variant={statusVariant}>{formatReceiptStatus(receipt.status)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex gap-3 rounded-lg border px-4 py-4">
            <StatusIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">{receiptStatusMessage(receipt)}</p>
              {receipt.rejectReason ? (
                <p className="text-destructive">{receipt.rejectReason}</p>
              ) : null}
            </div>
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Parsed result</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <ReceiptFact label="Cafeteria" value={receipt.parsed.cafeteriaName} />
              <ReceiptFact
                label="Purchased at"
                value={
                  receipt.parsed.purchasedAt
                    ? new Date(receipt.parsed.purchasedAt).toLocaleString()
                    : undefined
                }
              />
              <ReceiptFact
                label="Items"
                value={receipt.parsed.mealNames?.join(", ")}
              />
              <ReceiptFact
                label="Total"
                value={
                  receipt.parsed.totalPrice !== undefined
                    ? formatPriceKRW(receipt.parsed.totalPrice)
                    : undefined
                }
              />
            </dl>
          </section>

          {receipt.matchedMenuServings.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Matched menus</h2>
              <ul className="space-y-2">
                {receipt.matchedMenuServings.map((serving) => (
                  <li key={serving.id}>
                    <Link
                      href={`/menu-servings/${serving.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
                    >
                      <span>
                        <span className="font-medium">{serving.mealName}</span>
                        <span className="ml-2 text-muted-foreground">
                          {serving.cafeteriaName}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {formatPriceKRW(serving.price)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {receipt.confirmedMenuServingId ? (
              <Button asChild>
                <Link href={`/menu-servings/${receipt.confirmedMenuServingId}/reviews/new`}>
                  Continue review
                </Link>
              </Button>
            ) : null}
            {receipt.reviewId ? (
              <Button asChild variant="outline">
                <Link href={`/my-page/reviews?reviewId=${receipt.reviewId}`}>
                  Open my review
                </Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function BackButton() {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/notifications">
        <ArrowLeft className="h-4 w-4" />
        Back to notifications
      </Link>
    </Button>
  );
}

function ReceiptFact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value || "-"}</dd>
    </div>
  );
}

function receiptStatusIcon(status: Receipt["status"]) {
  switch (status) {
    case "OCR_PROCESSING":
      return Loader2;
    case "REJECTED":
      return CircleAlert;
    default:
      return CheckCircle2;
  }
}

function formatReceiptStatus(status: Receipt["status"]) {
  switch (status) {
    case "OCR_PROCESSING":
      return "Processing";
    case "NEED_CONFIRMATION":
      return "Needs confirmation";
    case "VERIFIED":
      return "Verified";
    case "REJECTED":
      return "Rejected";
    case "USED":
      return "Used";
    default:
      return status;
  }
}

function receiptStatusMessage(receipt: Receipt) {
  switch (receipt.status) {
    case "OCR_PROCESSING":
      return "OCR is still processing this receipt.";
    case "NEED_CONFIRMATION":
      return "OCR matched this receipt. Confirm the purchased menu to continue.";
    case "VERIFIED":
      return "This receipt is verified and can be used for a review.";
    case "REJECTED":
      return "This receipt could not be verified.";
    case "USED":
      return "This receipt has already been used for a review.";
    default:
      return "Receipt status was updated.";
  }
}
