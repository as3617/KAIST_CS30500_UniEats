// Helpers for the Asia/Seoul service timezone. The backend stores
// MenuServing.date as a local YYYY-MM-DD string in Asia/Seoul; the client
// should mirror that when constructing queries.

const TIMEZONE = "Asia/Seoul";
const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export function todayInSeoul(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

export function formatPriceKRW(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

export function weekdayInSeoul(date: Date = new Date()) {
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  }).format(date);
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    weekdayName,
  );
  return WEEKDAYS[index === -1 ? 0 : index];
}
