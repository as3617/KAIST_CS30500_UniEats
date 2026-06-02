"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiClientError, apiFetch } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import { formatPriceKRW } from "@/lib/date";
import type { Receipt, Review } from "@/types";

type Step = "upload" | "processing" | "confirm" | "write" | "done";

const MAX_RECEIPT_IMAGE_BYTES = 5 * 1024 * 1024;
const OCR_POLL_INTERVAL_MS = 2_000;
const OCR_POLL_TIMEOUT_MS = 60_000;

type NewReviewViewProps = {
  menuServingId: string;
};

export function NewReviewView({ menuServingId }: NewReviewViewProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPollingReceipt, setIsPollingReceipt] = useState(false);
  const [pollStartedAt, setPollStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Review form state
  const [rating, setRating] = useState(5);
  const [taste, setTaste] = useState(5);
  const [priceValue, setPriceValue] = useState(5);
  const [portion, setPortion] = useState(5);
  const [content, setContent] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setIsLoggedIn(!!authStorage.getUser());
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  useEffect(() => {
    if (step !== "processing" || !receipt || receipt.status !== "OCR_PROCESSING") {
      return;
    }

    const startedAt = pollStartedAt ?? Date.now();
    const receiptId = receipt.id;
    const controller = new AbortController();
    let timeoutId: number | undefined;
    let cancelled = false;

    setIsPollingReceipt(true);

    async function pollReceipt() {
      if (Date.now() - startedAt > OCR_POLL_TIMEOUT_MS) {
        setIsPollingReceipt(false);
        setError("OCR is taking longer than expected. You can check again or upload another receipt.");
        return;
      }

      try {
        const currentReceipt = await apiFetch<Receipt>(`/receipts/${receiptId}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (cancelled) return;

        if (currentReceipt.status === "OCR_PROCESSING") {
          timeoutId = window.setTimeout(pollReceipt, OCR_POLL_INTERVAL_MS);
          return;
        }

        setReceipt(currentReceipt);
        setPollStartedAt(null);
        setIsPollingReceipt(false);
        setStep("confirm");
      } catch (err) {
        if (controller.signal.aborted) return;
        setIsPollingReceipt(false);
        setError(err instanceof ApiClientError ? err.message : "Could not check OCR status.");
      }
    }

    timeoutId = window.setTimeout(pollReceipt, OCR_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [pollStartedAt, receipt, step]);

  if (!isLoggedIn) {
    return (
      <main className="container max-w-2xl space-y-6 py-8">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/menu-servings/${menuServingId}/reviews`}>
            <ArrowLeft className="h-4 w-4" />
            Back to reviews
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>You must be signed in to write a review.</CardDescription>
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

  function handleFileChange(file: File | null) {
    setError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!isReceiptImage(file)) {
      setSelectedFile(null);
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_RECEIPT_IMAGE_BYTES) {
      setSelectedFile(null);
      setError("Receipt image must be 5MB or smaller.");
      return;
    }
    setSelectedFile(file);
  }

  function resetReceiptFlow() {
    setReceipt(null);
    setSelectedFile(null);
    setIsPollingReceipt(false);
    setPollStartedAt(null);
    setStep("upload");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setIsSubmitting(true);
    setPollStartedAt(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      const currentReceipt = await apiFetch<Receipt>("/receipts/upload", {
        method: "POST",
        body: formData,
      });

      setReceipt(currentReceipt);
      if (currentReceipt.status === "OCR_PROCESSING") {
        setPollStartedAt(Date.now());
        setStep("processing");
      } else {
        setStep("confirm");
      }
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Upload failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleRetryPolling() {
    if (!receipt) return;
    setError(null);
    setPollStartedAt(Date.now());
    setIsPollingReceipt(true);
  }

  async function handleConfirm(confirmedMenuServingId: string) {
    if (!receipt) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await apiFetch<Receipt>(`/receipts/${receipt.id}/confirm`, {
        method: "POST",
        body: { confirmedMenuServingId },
      });
      setReceipt(result);
      setStep("write");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Confirmation failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitReview() {
    if (!receipt) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await apiFetch<Review>(`/menu-servings/${menuServingId}/reviews`, {
        method: "POST",
        body: {
          receiptId: receipt.id,
          rating,
          detailRatings: { taste, price: priceValue, portion },
          content: content.trim() || undefined,
        },
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to submit review.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="container max-w-2xl space-y-6 py-8">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/menu-servings/${menuServingId}/reviews`}>
          <ArrowLeft className="h-4 w-4" />
          Back to reviews
        </Link>
      </Button>

      <StepIndicator current={step} />

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload your receipt</CardTitle>
            <CardDescription>
              A receipt is required to write a verified review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border px-6 py-10 transition-colors hover:border-primary/60"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              {selectedFile ? (
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)}MB
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Click to select a receipt image</p>
              )}
            </div>
            {previewUrl ? (
              <div className="overflow-hidden rounded-lg border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="max-h-72 w-full object-contain"
                />
              </div>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? "Uploading..." : "Upload Receipt"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              JPG, PNG, or HEIC images up to 5MB are supported.
            </p>
          </CardContent>
        </Card>
      )}

      {step === "processing" && receipt && (
        <Card>
          <CardHeader>
            <CardTitle>Processing receipt</CardTitle>
            <CardDescription>
              We are checking the receipt text and matching it to menu data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border px-4 py-5">
              <Loader2 className={`h-5 w-5 ${isPollingReceipt ? "animate-spin" : ""}`} />
              <div>
                <p className="text-sm font-medium">
                  {isPollingReceipt ? "OCR is running..." : "OCR status check paused"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Receipt ID: {receipt.id}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleRetryPolling}
                disabled={isPollingReceipt}
              >
                Check again
              </Button>
              <Button type="button" variant="outline" onClick={resetReceiptFlow}>
                Upload another receipt
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "confirm" && receipt && (
        <Card>
          <CardHeader>
            <CardTitle>Confirm your purchase</CardTitle>
            <CardDescription>
              Select the meal you purchased from the matched options below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {receipt.parsed.cafeteriaName || receipt.parsed.mealNames ? (
              <div className="rounded-md bg-muted px-4 py-3 text-sm space-y-1">
                <p className="font-medium">OCR result</p>
                {receipt.parsed.cafeteriaName && (
                  <p className="text-muted-foreground">Cafeteria: {receipt.parsed.cafeteriaName}</p>
                )}
                {receipt.parsed.mealNames?.length ? (
                  <p className="text-muted-foreground">Items: {receipt.parsed.mealNames.join(", ")}</p>
                ) : null}
                {receipt.parsed.totalPrice !== undefined && (
                  <p className="text-muted-foreground">Total: {formatPriceKRW(receipt.parsed.totalPrice)}</p>
                )}
              </div>
            ) : null}

            <p className="text-sm font-medium">Which meal is this for?</p>
            {receipt.status === "REJECTED" ? (
              <div className="rounded-lg border border-dashed border-destructive/50 bg-destructive/5 px-4 py-6 text-center text-destructive">
                <p className="text-sm font-medium">Upload Rejected</p>
                <p className="mt-1 text-sm">{receipt.rejectReason || "This receipt could not be accepted."}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetReceiptFlow}
                  className="mt-4 border-destructive/20 text-destructive hover:bg-destructive/10"
                >
                  Try another receipt
                </Button>
              </div>
            ) : receipt.matchedMenuServings.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-6 text-center">
                <p className="text-sm font-medium">No matching menu or date found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please upload a receipt with a clearly visible date and menu name, or manually choose a meal from today&apos;s menu.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetReceiptFlow}
                  className="mt-4"
                >
                  Upload another receipt
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {sortMatchedServings(receipt, menuServingId).map((s) => {
                  const isCurrent = s.id === menuServingId;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => handleConfirm(s.id)}
                        disabled={isSubmitting}
                        className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors hover:border-primary/60 hover:bg-primary/5 ${
                          isCurrent ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <span className="font-medium">{s.mealName}</span>
                        <span className="ml-2 text-muted-foreground">
                          {s.cafeteriaName} &middot; {formatPriceKRW(s.price)}
                        </span>
                        {isCurrent && (
                          <span className="ml-2 text-xs text-primary">(current page)</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {step === "write" && (
        <Card>
          <CardHeader>
            <CardTitle>Write your review</CardTitle>
            <CardDescription>Share your experience with this meal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-medium">Overall rating</p>
              <StarRating value={rating} onChange={setRating} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Taste</p>
                <StarRating value={taste} onChange={setTaste} size="sm" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Value</p>
                <StarRating value={priceValue} onChange={setPriceValue} size="sm" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Portion</p>
                <StarRating value={portion} onChange={setPortion} size="sm" />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="review-content" className="text-sm font-medium">
                Comment <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="review-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe your experience..."
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <Button
              onClick={handleSubmitReview}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? "Submitting..." : "Submit Review"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle className="h-12 w-12 text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">Review submitted!</p>
              <p className="text-sm text-muted-foreground">Thank you for your verified review.</p>
            </div>
            <Button asChild>
              <Link href={`/menu-servings/${menuServingId}/reviews`}>
                View all reviews
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "processing", label: "OCR" },
    { key: "confirm", label: "Confirm" },
    { key: "write", label: "Review" },
    { key: "done", label: "Done" },
  ];
  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
              i < currentIndex
                ? "bg-primary text-primary-foreground"
                : i === currentIndex
                  ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`ml-1.5 text-xs font-medium ${
              i === currentIndex ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`mx-3 h-px w-8 ${i < currentIndex ? "bg-primary" : "bg-border"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function StarRating({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`leading-none transition-colors ${
            size === "sm" ? "text-lg" : "text-3xl"
          } ${star <= value ? "text-yellow-400" : "text-muted-foreground/30 hover:text-yellow-300"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function isReceiptImage(file: File) {
  if (file.type.startsWith("image/")) return true;
  return /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name);
}

function sortMatchedServings(receipt: Receipt, currentMenuServingId: string) {
  return [...receipt.matchedMenuServings].sort((a, b) => {
    if (a.id === currentMenuServingId) return -1;
    if (b.id === currentMenuServingId) return 1;
    return 0;
  });
}
