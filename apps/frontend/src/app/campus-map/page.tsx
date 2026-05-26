import type { Metadata } from "next";

import { CampusMapView } from "./campus-map-view";

export const metadata: Metadata = {
  title: "Campus map",
};

export default function CampusMapPage() {
  return <CampusMapView />;
}
