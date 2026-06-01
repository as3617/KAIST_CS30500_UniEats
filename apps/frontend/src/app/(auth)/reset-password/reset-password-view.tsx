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
import { isStrongEnoughPassword } from "@/lib/validation";

type ResetPasswordViewProps = {
  email?: string;
  token: string;
};

type PasswordResetConfirmResponse = {
  passwordReset: boolean;
};

export function ResetPasswordView({ email, token }: ResetPasswordViewProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(
    token ? null : "Password reset token is missing.",
  );
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSuccess(false);

    if (!token) {
      setError("Password reset token is missing.");
      return;
    }
    if (!isStrongEnoughPassword(password)) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await api.post<PasswordResetConfirmResponse>(
        "/auth/password-reset/confirm",
        { email: email || undefined, token, newPassword: password },
        { anonymous: true },
      );
      setIsSuccess(data.passwordReset);
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
        <CardTitle>Set new password</CardTitle>
        <CardDescription>Choose a new password for your UniEats account.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              disabled={isSubmitting || isSuccess}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm password</Label>
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              disabled={isSubmitting || isSuccess}
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
          {isSuccess ? (
            <p
              role="status"
              className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary"
            >
              Password reset complete.
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || isSuccess || !token}
          >
            {isSubmitting ? "Saving..." : "Set new password"}
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/login">{isSuccess ? "Continue to sign in" : "Back to sign in"}</Link>
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
