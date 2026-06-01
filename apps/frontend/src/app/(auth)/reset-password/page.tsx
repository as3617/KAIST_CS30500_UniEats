import type { Metadata } from "next";

import { ResetPasswordView } from "./reset-password-view";

export const metadata: Metadata = {
  title: "Set new password",
};

type ResetPasswordPageProps = {
  searchParams?: {
    email?: string;
    token?: string;
  };
};

export default function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  return (
    <ResetPasswordView
      email={normalizeEmail(searchParams?.email)}
      token={normalizeToken(searchParams?.token)}
    />
  );
}

function normalizeEmail(value?: string) {
  if (!value || value.length > 254) return "";
  return value;
}

function normalizeToken(value?: string) {
  if (!value || value.length > 512) return "";
  return value;
}
