import type { Metadata } from "next";

import { ProfileView } from "./profile-view";

export const metadata: Metadata = {
  title: "My Page",
};

export default function MyPage() {
  return <ProfileView />;
}
