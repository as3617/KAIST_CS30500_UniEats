import type { Metadata } from "next";
import { ReceiptDetailView } from "./receipt-detail-view";

export const metadata: Metadata = { title: "Receipt" };

type ReceiptPageProps = {
  params: { receiptId: string };
};

export default function ReceiptPage({ params }: ReceiptPageProps) {
  return <ReceiptDetailView receiptId={params.receiptId} />;
}
