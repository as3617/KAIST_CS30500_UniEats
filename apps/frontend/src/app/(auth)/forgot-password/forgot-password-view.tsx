"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError, api } from "@/lib/api";
import { isKaistEmail } from "@/lib/validation";

type PasswordResetResponse = {
  resetRequested: boolean;
  localPasswordReset?: {
    password: string;
    resetLink?: string;
  };
};

export function ForgotPasswordView() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setTemporaryPassword(null);

    if (!isKaistEmail(email)) {
      setError("Please use your @kaist.ac.kr email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await api.post<PasswordResetResponse>(
        "/auth/password-reset/request",
        { email },
        { anonymous: true },
      );
      setMessage(
        data.localPasswordReset
          ? "Password has been reset for local development."
          : "Password reset instructions have been sent.",
      );
      setTemporaryPassword(data.localPasswordReset?.password ?? null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Password reset failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>
          Enter your KAIST email to receive password reset instructions.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">KAIST email</Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              placeholder="student@kaist.ac.kr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          {message ? (
            <div
              role="status"
              className="space-y-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary"
            >
              <p>{message}</p>
              {temporaryPassword ? (
                <p>
                  Temporary password:{" "}
                  <span className="font-mono font-semibold">{temporaryPassword}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send reset link"}
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
