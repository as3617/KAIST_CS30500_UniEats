import type { Metadata } from "next";

import { ManagerView } from "./manager-view";

export const metadata: Metadata = {
  title: "Manager",
};

export default function ManagerPage() {
  return <ManagerView />;
}
