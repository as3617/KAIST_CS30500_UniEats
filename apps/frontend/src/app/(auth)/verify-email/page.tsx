import type { Metadata } from "next";

import { VerifyEmailView } from "./verify-email-view";

export const metadata: Metadata = {
  title: "Verify email",
};

type VerifyEmailPageProps = {
  searchParams?: {
    token?: string;
  };
};

export default function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  return <VerifyEmailView token={normalizeToken(searchParams?.token)} />;
}

function normalizeToken(value?: string) {
  if (!value || value.length > 512) return "";
  return value;
}
