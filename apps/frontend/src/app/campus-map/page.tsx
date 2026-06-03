import type { Metadata } from "next";

import { CampusMapView } from "./campus-map-view";

export const metadata: Metadata = {
  title: "Campus map",
};

export const dynamic = "force-dynamic";

export default function CampusMapPage() {
  return (
    <CampusMapView
      kakaoMapAppKey={
        process.env.KAKAO_MAP_APP_KEY ?? process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY ?? ""
      }
    />
  );
}
