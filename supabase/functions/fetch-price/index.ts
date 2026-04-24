import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { yahooFinance, withYahooTickerFallback } from "../_shared/yahoo.ts";
import {
  fetchYahooChartQuote,
  isYahooRateLimitError,
  shouldSkipPriceRefresh,
  type YahooChartQuote,
} from "../_shared/yahoo-price.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INDUSTRY_PER_MAP: Record<string, number> = {
  Technology: 28,
  "Consumer Cyclical": 22,
  "Communication Services": 20,
  Healthcare: 25,
  "Financial Services": 14,
  "Consumer Defensive": 24,
  Industrials: 20,
  Energy: 12,
  Utilities: 18,
  "Real Estate": 35,
  "Basic Materials": 15,
};

function getIndustryPer(sector: string | undefined, market: string): number {
  if (sector && INDUSTRY_PER_MAP[sector]) {
    return INDUSTRY_PER_MAP[sector];
  }
  return market === "KR" ? 12 : 22;
}

function toPositiveNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function optionalNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;

  return token;
}

function parseBody(reqBody: unknown): { ticker?: string; market?: "US" | "KR"; name?: string } {
  if (!reqBody || typeof reqBody !== "object") return {};

  const body = reqBody as Record<string, unknown>;

  const ticker =
    typeof body.ticker === "string" && body.ticker.trim().length > 0
      ? body.ticker.trim().toUpperCase()
      : undefined;
  const market = body.market === "US" || body.market === "KR" ? body.market : undefined;
  const name =
    typeof body.name === "string" && body.name.trim().length > 0 ? body.name.trim() : undefined;

  return { ticker, market, name };
}

type HoldingRow = {
  ticker: string;
  market: "US" | "KR";
  name: string;
  currency: string;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchQuoteWithFallback(
  ticker: string,
  market: "US" | "KR",
): Promise<{ quote: YahooChartQuote; yfTicker: string }> {
  const { result, yfTicker } = await withYahooTickerFallback(
    ticker,
    market,
    (candidate) => fetchYahooChartQuote(candidate),
    (candidateQuote) => candidateQuote.currentPrice > 0,
    isYahooRateLimitError,
  );

  return { quote: result, yfTicker };
}

function isSchemaCacheColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  return /schema cache|could not find|column/i.test(message ?? "");
}

async function updatePriceSnapshot(
  supabase: ReturnType<typeof createClient>,
  id: string,
  basePayload: Record<string, unknown>,
  optionalPayload: Record<string, unknown>,
): Promise<"full" | "base"> {
  const { error } = await supabase
    .from("price_snapshots")
    .update({ ...basePayload, ...optionalPayload })
    .eq("id", id);

  if (!error) return "full";
  if (!isSchemaCacheColumnError(error)) throw error;

  console.warn(
    "[fetch-price] optional price snapshot columns unavailable; retrying base update:",
    error.message,
  );

  const { error: fallbackError } = await supabase
    .from("price_snapshots")
    .update(basePayload)
    .eq("id", id);

  if (fallbackError) throw fallbackError;
  return "base";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
      throw new Error("Missing Supabase env vars");
    }

    // Validate incoming user token in-function.
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error("fetch-price auth.getUser failed:", authError?.message ?? "No user");
      return jsonResponse({ error: "Unauthorized", detail: authError?.message ?? null }, 401);
    }

    // Use service role only after authentication succeeds.
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const rawBody = await req.json();
    const { ticker: targetTicker, market: targetMarket, name: targetName } = parseBody(rawBody);
    let holdings: HoldingRow[] = [];

    if (targetTicker && targetMarket) {
      const { data: existing } = await supabase
        .from("price_snapshots")
        .select("id")
        .eq("ticker", targetTicker)
        .eq("market", targetMarket)
        .maybeSingle();

      if (!existing) {
        const currency = targetMarket === "KR" ? "KRW" : "USD";
        await supabase.from("price_snapshots").insert({
          ticker: targetTicker,
          market: targetMarket,
          name: targetName ?? targetTicker,
          currency,
          current_price: 0,
          is_stale: true,
          industry_per: getIndustryPer(undefined, targetMarket),
        });
      }
    } else {
      // Recover missing snapshots from active holdings.
      const { data: activeHoldings, error: holdingsError } = await supabase
        .from("portfolio_assets")
        .select("ticker, market, name, currency")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (holdingsError) throw holdingsError;
      holdings = (activeHoldings ?? []) as HoldingRow[];

      for (const holding of holdings) {
        const { data: existing } = await supabase
          .from("price_snapshots")
          .select("id")
          .eq("ticker", holding.ticker)
          .eq("market", holding.market)
          .maybeSingle();

        if (!existing) {
          await supabase.from("price_snapshots").insert({
            ticker: holding.ticker,
            market: holding.market,
            name: holding.name ?? holding.ticker,
            currency: holding.currency ?? (holding.market === "KR" ? "KRW" : "USD"),
            current_price: 0,
            is_stale: true,
            industry_per: getIndustryPer(undefined, holding.market),
          });
        }
      }
    }

    let query = supabase.from("price_snapshots").select("*");
    if (targetTicker) {
      query = query.eq("ticker", targetTicker);
      if (targetMarket) query = query.eq("market", targetMarket);
    } else {
      const uniqueTickers = [...new Set(holdings.map((holding) => holding.ticker))];
      if (uniqueTickers.length === 0) {
        return jsonResponse({ success: true, count: 0 });
      }
      query = query.in("ticker", uniqueTickers);
    }

    const { data: assets, error } = await query;
    if (error) throw error;

    if (!assets || assets.length === 0) {
      return jsonResponse({ success: true, count: 0 });
    }

    let updatedCount = 0;
    const now = new Date().toISOString();
    const results: Array<{ ticker: string; price: number; status: string }> = [];

    // 환율 조회 (USD/KRW) — 전체 동기화에서 한 번만 수행
    let exchangeRate: number | null = null;
    try {
      const fxQuote = await fetchYahooChartQuote("USDKRW=X");
      exchangeRate = optionalNumber(fxQuote.currentPrice);
    } catch (fxErr) {
      console.warn(
        "[fetch-price] USDKRW exchange rate fetch failed:",
        fxErr instanceof Error ? fxErr.message : fxErr,
      );
    }

    for (const asset of assets) {
      try {
        if (shouldSkipPriceRefresh(asset)) {
          results.push({
            ticker: asset.ticker,
            price: Number(asset.current_price),
            status: "cached",
          });
          continue;
        }

        const market = asset.market === "KR" ? "KR" : "US";
        const { quote, yfTicker } = await fetchQuoteWithFallback(asset.ticker, market);

        const currentPrice = toPositiveNumber(quote.currentPrice);
        if (!currentPrice) {
          throw new Error(`Invalid regularMarketPrice for ${yfTicker}`);
        }

        const prevClose = toPositiveNumber(quote.prevClose) ?? currentPrice;
        let eps = toPositiveNumber(asset.eps);
        let per = toPositiveNumber(asset.per);

        if (!eps || !per) {
          try {
            const summary = await yahooFinance.quoteSummary(yfTicker, {
              modules: ["defaultKeyStatistics", "summaryDetail", "financialData"],
            });
            const summaryObj = summary as Record<string, unknown>;
            const stats = (summaryObj.defaultKeyStatistics ?? {}) as Record<string, unknown>;
            const detail = (summaryObj.summaryDetail ?? {}) as Record<string, unknown>;
            const financial = (summaryObj.financialData ?? {}) as Record<string, unknown>;

            eps =
              eps ??
              toPositiveNumber(stats.trailingEps) ??
              toPositiveNumber(financial.epsTrailingTwelveMonths);
            per = per ?? toPositiveNumber(detail.trailingPE) ?? toPositiveNumber(stats.forwardPE);
          } catch (summaryErr) {
            const msg = summaryErr instanceof Error ? summaryErr.message : String(summaryErr);
            console.warn(`quoteSummary fallback failed for ${yfTicker}:`, msg);
          }
        }

        if (!eps && per) eps = currentPrice / per;
        if (!per && eps) per = currentPrice / eps;

        const industryPer =
          toPositiveNumber(asset.industry_per) ?? getIndustryPer(undefined, asset.market);
        const name = quote.shortName ?? undefined;

        // 추가 재무 데이터 수집
        const basePayload: Record<string, unknown> = {
          current_price: currentPrice,
          prev_close: prevClose,
          eps: eps ?? null,
          per: per ?? null,
          industry_per: industryPer,
          last_synced_at: now,
          is_stale: false,
          // Phase 1 추가 필드
        };
        const optionalPayload: Record<string, unknown> = {
          exchange_rate: exchangeRate,
        };

        if (name && (asset.name === asset.ticker || asset.name === "")) {
          basePayload.name = name;
        }

        await updatePriceSnapshot(supabase, asset.id, basePayload, optionalPayload);

        updatedCount += 1;
        results.push({ ticker: asset.ticker, price: currentPrice, status: "ok" });
        await delay(250);
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error(`Error fetching ${asset.ticker}:`, errMsg);
        const { error: staleError } = await supabase
          .from("price_snapshots")
          .update({ is_stale: true })
          .eq("id", asset.id);
        if (staleError) {
          console.warn(
            `[fetch-price] failed to mark ${asset.ticker} as stale:`,
            staleError.message,
          );
        }
        results.push({
          ticker: asset.ticker,
          price: Number(asset.current_price ?? 0),
          status: isYahooRateLimitError(e) ? "rate_limited" : "error",
        });
        if (isYahooRateLimitError(e)) break;
      }
    }

    return jsonResponse({ success: true, count: updatedCount, results });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("fetch-price Error:", errMsg);
    return jsonResponse({ error: errMsg }, 400);
  }
});
