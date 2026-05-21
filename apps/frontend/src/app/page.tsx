import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="container mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 py-12">
      <header className="space-y-3 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          KAIST campus dining
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          UniEats
        </h1>
        <p className="mx-auto max-w-md text-balance text-muted-foreground">
          Browse today&apos;s menus, manage your allergy profile, and share
          receipt-verified reviews from KAIST cafeterias.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Start exploring</CardTitle>
          <CardDescription>
            Pick a destination to see the frontend skeleton in action. The mock
            API is enabled by default in development.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Button asChild>
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/register">Create account</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
