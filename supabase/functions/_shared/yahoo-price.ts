const PRICE_REFRESH_TTL_MS = 15 * 60 * 1000;

export type PriceSnapshotLike = {
  current_price?: number | string | null;
  is_stale?: boolean | null;
  last_synced_at?: string | null;
};

export type YahooChartQuote = {
  currentPrice: number;
  prevClose: number;
  currency: string | null;
  shortName: string | null;
};

export class YahooRateLimitError extends Error {
  constructor(message = "Yahoo Finance rate limit exceeded") {
    super(message);
    this.name = "YahooRateLimitError";
  }
}

function toPositiveNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function isYahooRateLimitError(error: unknown): boolean {
  if (error instanceof YahooRateLimitError) return true;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  return /too many requests|rate limit|429|crumb=Edge/i.test(message ?? "");
}

export function shouldSkipPriceRefresh(
  snapshot: PriceSnapshotLike,
  now = Date.now(),
  ttlMs = PRICE_REFRESH_TTL_MS,
): boolean {
  const currentPrice = toPositiveNumber(snapshot.current_price);
  if (!currentPrice || snapshot.is_stale) return false;

  const syncedAt = snapshot.last_synced_at ? Date.parse(snapshot.last_synced_at) : Number.NaN;
  if (!Number.isFinite(syncedAt)) return false;

  return now - syncedAt < ttlMs;
}

export function parseYahooChartQuote(payload: unknown, yfTicker: string): YahooChartQuote {
  const chart = readObject(readObject(payload).chart);
  const chartError = chart.error;
  if (chartError) {
    throw new Error(`Yahoo chart error for ${yfTicker}: ${JSON.stringify(chartError)}`);
  }

  const result = Array.isArray(chart.result) ? chart.result[0] : null;
  const meta = readObject(readObject(result).meta);
  const currentPrice = toPositiveNumber(meta.regularMarketPrice);
  if (!currentPrice) {
    throw new Error(`Invalid Yahoo chart regularMarketPrice for ${yfTicker}`);
  }

  const prevClose =
    toPositiveNumber(meta.previousClose) ??
    toPositiveNumber(meta.chartPreviousClose) ??
    currentPrice;

  return {
    currentPrice,
    prevClose,
    currency: typeof meta.currency === "string" ? meta.currency : null,
    shortName: typeof meta.shortName === "string" ? meta.shortName : null,
  };
}

export async function fetchYahooChartQuote(
  yfTicker: string,
  fetchImpl: typeof fetch = fetch,
): Promise<YahooChartQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yfTicker,
  )}?interval=1d&range=1d`;

  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; WealthConsole/1.0; +https://supabase.com/functions)",
    },
  });

  const text = await response.text();
  if (response.status === 429 || /too many requests/i.test(text)) {
    throw new YahooRateLimitError(
      `Yahoo Finance returned ${response.status}: ${text.slice(0, 120)}`,
    );
  }

  if (!response.ok) {
    throw new Error(`Yahoo chart request failed for ${yfTicker}: HTTP ${response.status}`);
  }

  try {
    return parseYahooChartQuote(JSON.parse(text), yfTicker);
  } catch (error) {
    if (isYahooRateLimitError(error)) throw error;
    throw new Error(
      `Invalid Yahoo chart response for ${yfTicker}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
