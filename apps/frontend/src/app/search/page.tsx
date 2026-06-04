import type { Metadata } from "next";

import { SearchView } from "./search-view";

export const metadata: Metadata = {
  title: "Search",
};

type SearchPageProps = {
  searchParams?: {
    q?: string;
  };
};

export default function SearchPage({ searchParams }: SearchPageProps) {
  return <SearchView initialQuery={searchParams?.q ?? ""} />;
}
