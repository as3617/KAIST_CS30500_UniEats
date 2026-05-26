import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="container flex min-h-screen max-w-md flex-col justify-center py-12">
      <div className="mb-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center text-2xl font-bold tracking-tight"
        >
          UniEats
        </Link>
        <p className="mt-2 text-sm text-muted-foreground">
          KAIST campus dining, verified by receipt.
        </p>
      </div>
      {children}
    </main>
  );
}
