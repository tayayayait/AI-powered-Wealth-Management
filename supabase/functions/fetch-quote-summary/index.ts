import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { yahooFinance, withYahooTickerFallback } from "../_shared/yahoo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const quoteSummaryModules = [
  "financialData",
  "defaultKeyStatistics",
  "summaryDetail",
  "assetProfile",
  "earnings",
] as const;

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

function safeNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase env vars");
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const rawBody = await req.json();
    const ticker = typeof rawBody?.ticker === "string" ? rawBody.ticker.trim().toUpperCase() : "";
    const market = rawBody?.market === "US" || rawBody?.market === "KR" ? rawBody.market : "US";

    if (!ticker) {
      return jsonResponse({ error: "ticker is required" }, 400);
    }

    let summary: Record<string, unknown> = {};
    let resolvedYfTicker = ticker;
    try {
      const { result: rawSummary, yfTicker } = await withYahooTickerFallback(
        ticker,
        market,
        (candidate) =>
          yahooFinance.quoteSummary(candidate, {
            modules: [...quoteSummaryModules],
          }),
      );
      summary = rawSummary as Record<string, unknown>;
      resolvedYfTicker = yfTicker;
    } catch (e) {
      console.warn(`quoteSummary failed for ${ticker}:`, e instanceof Error ? e.message : e);
    }

    const financial = (summary.financialData ?? {}) as Record<string, unknown>;
    const stats = (summary.defaultKeyStatistics ?? {}) as Record<string, unknown>;
    const detail = (summary.summaryDetail ?? {}) as Record<string, unknown>;
    const profile = (summary.assetProfile ?? {}) as Record<string, unknown>;

    let recommendations: Array<Record<string, unknown>> = [];
    try {
      const { result: recResult, yfTicker } = await withYahooTickerFallback(
        ticker,
        market,
        (candidate) => yahooFinance.recommendationsBySymbol(candidate),
      );
      resolvedYfTicker = yfTicker;
      const recAny = recResult as Record<string, unknown>;
      recommendations = (recAny.recommendedSymbols ?? []) as Array<Record<string, unknown>>;
    } catch (e) {
      console.warn(
        `recommendations failed for ${resolvedYfTicker}:`,
        e instanceof Error ? e.message : e,
      );
    }

    const result = {
      ticker,
      market,
      profile: {
        sector: (profile.sector ?? null) as string | null,
        industry: (profile.industry ?? null) as string | null,
        country: (profile.country ?? null) as string | null,
        employees: safeNum(profile.fullTimeEmployees),
        website: (profile.website ?? null) as string | null,
        summary: (profile.longBusinessSummary ?? null) as string | null,
      },
      financials: {
        returnOnEquity: safeNum(financial.returnOnEquity),
        returnOnAssets: safeNum(financial.returnOnAssets),
        grossMargins: safeNum(financial.grossMargins),
        operatingMargins: safeNum(financial.operatingMargins),
        profitMargins: safeNum(financial.profitMargins),
        totalRevenue: safeNum(financial.totalRevenue),
        revenueGrowth: safeNum(financial.revenueGrowth),
        ebitda: safeNum(financial.ebitda),
        freeCashflow: safeNum(financial.freeCashflow),
        currentPrice: safeNum(financial.currentPrice),
        targetMeanPrice: safeNum(financial.targetMeanPrice),
        targetHighPrice: safeNum(financial.targetHighPrice),
        targetLowPrice: safeNum(financial.targetLowPrice),
        recommendationKey: (financial.recommendationKey ?? null) as string | null,
        numberOfAnalystOpinions: safeNum(financial.numberOfAnalystOpinions),
      },
      keyStats: {
        priceToBook: safeNum(stats.priceToBook),
        bookValue: safeNum(stats.bookValue),
        forwardPE: safeNum(stats.forwardPE),
        pegRatio: safeNum(stats.pegRatio),
        enterpriseValue: safeNum(stats.enterpriseValue),
        enterpriseToRevenue: safeNum(stats.enterpriseToRevenue),
        enterpriseToEbitda: safeNum(stats.enterpriseToEbitda),
        beta: safeNum(stats.beta),
        trailingEps: safeNum(stats.trailingEps),
        forwardEps: safeNum(stats.forwardEps),
        sharesOutstanding: safeNum(stats.sharesOutstanding),
      },
      summaryDetail: {
        marketCap: safeNum(detail.marketCap),
        dividendYield: safeNum(detail.dividendYield),
        dividendRate: safeNum(detail.dividendRate),
        exDividendDate: (detail.exDividendDate ?? null) as string | null,
        payoutRatio: safeNum(detail.payoutRatio),
        fiftyTwoWeekHigh: safeNum(detail.fiftyTwoWeekHigh),
        fiftyTwoWeekLow: safeNum(detail.fiftyTwoWeekLow),
        fiftyDayAverage: safeNum(detail.fiftyDayAverage),
        twoHundredDayAverage: safeNum(detail.twoHundredDayAverage),
        trailingPE: safeNum(detail.trailingPE),
        forwardPE: safeNum(detail.forwardPE),
      },
      recommendations: recommendations.slice(0, 5).map((r) => ({
        symbol: r.symbol as string,
        score: safeNum(r.score),
      })),
    };

    return jsonResponse(result);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("fetch-quote-summary Error:", errMsg);
    return jsonResponse({ error: errMsg }, 400);
  }
});
