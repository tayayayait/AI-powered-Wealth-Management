import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { yahooFinance } from "../_shared/yahoo.ts";

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

/**
 * 한국 거래소 코드를 시장 코드로 변환
 */
function resolveMarket(exchange: string | undefined): "US" | "KR" | null {
  if (!exchange) return null;
  const ex = exchange.toUpperCase();
  // 한국 거래소: KSE(KRX), KOS(KOSDAQ), KSC(KOSPI)
  if (["KSE", "KOS", "KSC", "KRX"].some((k) => ex.includes(k))) return "KR";
  // 미국 거래소: NMS(NASDAQ), NYQ(NYSE), NYS(NYSE), PCX(ARCA), BTS(BATS)
  if (["NMS", "NYQ", "NYS", "PCX", "BTS", "NGM", "NCM", "ASE"].some((k) => ex.includes(k)))
    return "US";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 인증 검증
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

    // 요청 body 파싱
    const rawBody = await req.json();
    const query = typeof rawBody?.query === "string" ? rawBody.query.trim() : "";
    const marketFilter =
      rawBody?.market === "US" || rawBody?.market === "KR" ? rawBody.market : undefined;

    if (!query || query.length < 1) {
      return jsonResponse({ results: [] });
    }

    // Yahoo Finance search API 호출
    const searchResult = await yahooFinance.search(query, {
      quotesCount: 12,
      newsCount: 0,
    });

    const quotes = searchResult.quotes ?? [];

    // Equity 타입만 필터링하고 정리
    const results = quotes
      .filter((q: Record<string, unknown>) => {
        const type = (q.quoteType ?? q.typeDisp ?? "") as string;
        return type === "EQUITY" || type === "Equity" || type === "equity";
      })
      .map((q: Record<string, unknown>) => {
        const symbol = (q.symbol as string) ?? "";
        const exchange = (q.exchange ?? q.exchDisp ?? "") as string;
        const market = resolveMarket(exchange);

        return {
          symbol: symbol.replace(/\.KS$|\.KQ$/, ""),
          name: (q.shortname ?? q.longname ?? symbol) as string,
          exchange: (q.exchDisp ?? exchange) as string,
          type: "Equity",
          market: market ?? "US",
          rawSymbol: symbol,
        };
      })
      .filter((r) => {
        if (!marketFilter) return true;
        return r.market === marketFilter;
      })
      .slice(0, 8);

    return jsonResponse({ results });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("search-ticker Error:", errMsg);
    return jsonResponse({ error: errMsg }, 400);
  }
});
