import Link from "next/link";
import {
  Bell,
  BriefcaseBusiness,
  Heart,
  MapPinned,
  ReceiptText,
  Search,
  ShieldCheck,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type GuideSection = {
  title: string;
  description: string;
  icon: LucideIcon;
  items: string[];
  href?: string;
  action?: string;
};

export const metadata: Metadata = { title: "Help" };

const guideSections: GuideSection[] = [
  {
    title: "Find meals",
    description: "Browse current KAIST cafeteria menus with filters that match dining routines.",
    icon: Search,
    href: "/search",
    action: "Search menus",
    items: [
      "Use date, cafeteria, meal time, cuisine, and dietary option filters together.",
      "Signed-in searches prioritize meals that match preferred ingredients and lower disliked matches.",
      "Sold out status updates appear on menu cards without a manual refresh.",
    ],
  },
  {
    title: "Campus map",
    description: "Check cafeteria locations before choosing where to eat.",
    icon: MapPinned,
    href: "/campus-map",
    action: "Open map",
    items: [
      "The map starts around Kaimaru and moves to selected cafeteria groups.",
      "Browse menus from a selected cafeteria to keep the dining hall filter applied.",
      "Kaimaru food court stores are shown as separate cafeterias at the same building.",
    ],
  },
  {
    title: "Dietary profile",
    description: "Keep allergy warnings and personalized ordering tied to your account.",
    icon: ShieldCheck,
    href: "/my-page",
    action: "Edit profile",
    items: [
      "Allergies add warnings to menu cards and details after sign-in.",
      "The hide-conflicts option removes meals that match your allergy profile.",
      "Preferred and disliked ingredients adjust recommendation and search ordering.",
    ],
  },
  {
    title: "Favorite meals",
    description: "Save meals you want to find again and receive status change alerts.",
    icon: Heart,
    href: "/my-page",
    action: "View favorites",
    items: [
      "Use the heart button on menu cards and menu detail pages.",
      "Favorite meals appear on My Page for quick browsing.",
      "Menu status notifications are sent when a favorited meal changes availability.",
    ],
  },
  {
    title: "Receipts and reviews",
    description: "Receipt verification keeps reviews tied to real cafeteria purchases.",
    icon: ReceiptText,
    href: "/search",
    action: "Find a meal",
    items: [
      "Open a menu detail page and start a new review to upload a receipt or order slip.",
      "When OCR finds a matching menu serving, review writing becomes available.",
      "Rejected or already-used receipts cannot be reused for another review.",
    ],
  },
  {
    title: "Notifications",
    description: "Follow review, receipt, and menu status events in one place.",
    icon: Bell,
    href: "/notifications",
    action: "Open notifications",
    items: [
      "Unread count is shown in the navigation after sign-in.",
      "Review reply notifications link back to the related review.",
      "Receipt and menu status notifications link to the related resource.",
    ],
  },
  {
    title: "Manager workspace",
    description: "Cafeteria managers can maintain menus and respond to verified feedback.",
    icon: BriefcaseBusiness,
    href: "/manager",
    action: "Open manager",
    items: [
      "Manager access appears only for assigned managers and admins.",
      "Create a meal and serving in one request to avoid orphan menu records.",
      "Update serving status when a meal becomes available, sold out, or hidden.",
    ],
  },
  {
    title: "Account access",
    description: "KAIST email verification protects account ownership and review trust.",
    icon: UserRound,
    href: "/login",
    action: "Sign in",
    items: [
      "Register with a kaist.ac.kr email address.",
      "Use the verification link before editing protected profile settings.",
      "Password reset is available from the sign-in page.",
    ],
  },
];

export default function HelpPage() {
  return (
    <main className="container max-w-5xl space-y-8 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Badge variant="secondary" className="w-fit gap-1.5">
            <UtensilsCrossed className="h-3.5 w-3.5" />
            App guide
          </Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              UniEats help
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Quick references for browsing campus menus, managing dietary
              settings, writing verified reviews, and using manager tools.
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {guideSections.map((section) => (
          <Card key={section.title} className="flex flex-col">
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <section.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {section.href && section.action ? (
                <Button asChild variant="outline" size="sm" className="w-fit">
                  <Link href={section.href}>{section.action}</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
