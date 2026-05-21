import { mockCafeterias } from "@/mocks/data";
import { okJson } from "@/mocks/respond";

export async function GET() {
  return okJson(mockCafeterias);
}
