"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MailCheck, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiClientError, api } from "@/lib/api";

type VerifyEmailViewProps = {
  token: string;
};

type VerifyState =
  | { status: "loading"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function VerifyEmailView({ token }: VerifyEmailViewProps) {
  const [state, setState] = useState<VerifyState>(() =>
    token
      ? { status: "loading", message: "Verifying your KAIST email..." }
      : { status: "error", message: "Verification token is missing." },
  );

  useEffect(() => {
    let isCurrent = true;
    if (!token) return;

    api
      .get<{ isEmailVerified: boolean }>("/auth/verify-email", {
        anonymous: true,
        query: { token },
      })
      .then((data) => {
        if (!isCurrent) return;
        setState(
          data.isEmailVerified
            ? {
                status: "success",
                message: "Your KAIST email has been verified.",
              }
            : {
                status: "error",
                message: "Email verification could not be completed.",
              },
        );
      })
      .catch((err) => {
        if (!isCurrent) return;
        setState({
          status: "error",
          message:
            err instanceof ApiClientError
              ? err.message
              : "Email verification failed. Please try again.",
        });
      });

    return () => {
      isCurrent = false;
    };
  }, [token]);

  const isLoading = state.status === "loading";
  const isSuccess = state.status === "success";

  return (
    <Card>
      <CardHeader className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isSuccess ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            <XCircle className="h-6 w-6 text-destructive" />
          )}
        </div>
        <div className="space-y-2">
          <CardTitle>
            {isLoading
              ? "Checking verification link"
              : isSuccess
                ? "Email verified"
                : "Verification failed"}
          </CardTitle>
          <CardDescription>{state.message}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3 rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Verified accounts can manage dietary profiles, upload receipts, and
            submit official reviews.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button asChild className="w-full" disabled={isLoading}>
          <Link href={isSuccess ? "/login" : "/register"}>
            {isSuccess ? "Continue to sign in" : "Back to registration"}
          </Link>
        </Button>
        {!isSuccess ? (
          <Button asChild variant="ghost" className="w-full" disabled={isLoading}>
            <Link href="/login">Sign in instead</Link>
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
