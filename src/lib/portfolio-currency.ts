export type MarketCode = "US" | "KR";
export type CurrencyCode = "USD" | "KRW";

const MARKET_CURRENCY: Record<MarketCode, CurrencyCode> = {
  US: "USD",
  KR: "KRW",
};

export function currencyForMarket(market: MarketCode): CurrencyCode {
  return MARKET_CURRENCY[market];
}

export function normalizeCurrency(currency?: string | null): CurrencyCode {
  return currency === "USD" ? "USD" : "KRW";
}

export function resolveDisplayCurrency(
  rows: Array<{ market: MarketCode }>,
  portfolioBaseCurrency?: string | null,
): CurrencyCode {
  const markets = [...new Set(rows.map((row) => row.market))];

  if (markets.length === 1) {
    return currencyForMarket(markets[0]);
  }

  return normalizeCurrency(portfolioBaseCurrency);
}

export function convertCurrency(
  amount: number,
  fromCurrency: string | null | undefined,
  toCurrency: CurrencyCode,
  usdKrwRate: number | null | undefined,
): number {
  const from = normalizeCurrency(fromCurrency);
  if (from === toCurrency) return amount;

  const rate = Number(usdKrwRate);
  if (!Number.isFinite(rate) || rate <= 0) return amount;

  return from === "USD" && toCurrency === "KRW" ? amount * rate : amount / rate;
}
