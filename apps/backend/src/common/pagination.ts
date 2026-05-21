const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function firstValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePositiveInt(value: unknown, fallback: number): number {
  const raw = firstValue(value);
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export function parsePagination(query: Record<string, unknown>) {
  const page = parsePositiveInt(query.page, DEFAULT_PAGE);
  const requestedLimit = parsePositiveInt(query.limit, DEFAULT_LIMIT);
  const limit = Math.min(requestedLimit, MAX_LIMIT);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}
