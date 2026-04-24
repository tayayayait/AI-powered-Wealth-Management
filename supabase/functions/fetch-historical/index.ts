import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { yahooFinance, withYahooTickerFallback } from "../_shared/yahoo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function periodToDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case "1M":
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case "3M":
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case "6M":
      return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case "1Y":
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case "3Y":
      return new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
    case "5Y":
      return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    case "MAX":
      return new Date(2000, 0, 1);
    default:
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  }
}

function resolveInterval(period: string, explicit?: string): "1d" | "1wk" | "1mo" {
  if (explicit === "1d" || explicit === "1wk" || explicit === "1mo") return explicit;
  switch (period) {
    case "1M":
    case "3M":
    case "6M":
    case "1Y":
      return "1d";
    case "3Y":
      return "1wk";
    case "5Y":
    case "MAX":
      return "1mo";
    default:
      return "1d";
  }
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
    const period = typeof rawBody?.period === "string" ? rawBody.period : "1Y";
    const interval = resolveInterval(period, rawBody?.interval);

    if (!ticker) {
      return jsonResponse({ error: "ticker is required" }, 400);
    }

    const period1 = periodToDate(period);
    const period2 = new Date();
    const historicalQuery = {
      period1: period1.toISOString().split("T")[0],
      period2: period2.toISOString().split("T")[0],
      interval,
    };

    const { result: history } = await withYahooTickerFallback(ticker, market, (candidate) =>
      yahooFinance.historical(candidate, historicalQuery),
    );

    if (!history || history.length === 0) {
      return jsonResponse({
        ticker,
        market,
        period,
        interval,
        data: [],
      });
    }

    const data = history
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const da = new Date(a.date as string);
        const db = new Date(b.date as string);
        return da.getTime() - db.getTime();
      })
      .map((item: Record<string, unknown>) => ({
        date: new Date(item.date as string).toISOString().split("T")[0],
        open: item.open ?? null,
        high: item.high ?? null,
        low: item.low ?? null,
        close: item.close ?? null,
        volume: item.volume ?? null,
        adjClose: item.adjClose ?? item.close ?? null,
      }));

    return jsonResponse({
      ticker,
      market,
      period,
      interval,
      data,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("fetch-historical Error:", errMsg);
    return jsonResponse({ error: errMsg }, 400);
  }
});
