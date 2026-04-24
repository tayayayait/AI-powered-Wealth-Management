import yahooFinance from "npm:yahoo-finance2@2.11.3";

export type SupportedMarket = "US" | "KR";

export function getYahooTickerCandidates(ticker: string, market: SupportedMarket): string[] {
  const normalized = ticker.trim().toUpperCase();
  if (market === "KR") {
    return [`${normalized}.KS`, `${normalized}.KQ`, normalized];
  }
  return [normalized];
}

export async function withYahooTickerFallback<T>(
  ticker: string,
  market: SupportedMarket,
  request: (yfTicker: string) => Promise<T>,
  validateResult?: (result: T) => boolean,
  shouldAbort?: (error: unknown) => boolean,
): Promise<{ result: T; yfTicker: string }> {
  const candidates = getYahooTickerCandidates(ticker, market);
  let lastError: unknown = null;

  for (const yfTicker of candidates) {
    try {
      const result = await request(yfTicker);
      if (!validateResult || validateResult(result)) {
        return { result, yfTicker };
      }
    } catch (error) {
      if (shouldAbort?.(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(`No Yahoo Finance data for ${ticker}`);
}

export { yahooFinance };
