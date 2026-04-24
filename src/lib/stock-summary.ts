import { supabase } from "@/integrations/supabase/client";

const TOKEN_REFRESH_LEEWAY_SECONDS = 30;

// ── 응답 타입 ───────────────────────────────────────────────

export interface CompanyProfile {
  sector: string | null;
  industry: string | null;
  country: string | null;
  employees: number | null;
  website: string | null;
  summary: string | null;
}

export interface FinancialData {
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  grossMargins: number | null;
  operatingMargins: number | null;
  profitMargins: number | null;
  totalRevenue: number | null;
  revenueGrowth: number | null;
  ebitda: number | null;
  freeCashflow: number | null;
  currentPrice: number | null;
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
  recommendationKey: string | null;
  numberOfAnalystOpinions: number | null;
}

export interface KeyStats {
  priceToBook: number | null;
  bookValue: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  enterpriseValue: number | null;
  enterpriseToRevenue: number | null;
  enterpriseToEbitda: number | null;
  beta: number | null;
  trailingEps: number | null;
  forwardEps: number | null;
  sharesOutstanding: number | null;
}

export interface SummaryDetail {
  marketCap: number | null;
  dividendYield: number | null;
  dividendRate: number | null;
  exDividendDate: string | null;
  payoutRatio: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
}

export interface RecommendedSymbol {
  symbol: string;
  score: number | null;
}

export interface QuoteSummaryResponse {
  ticker: string;
  market: "US" | "KR";
  profile: CompanyProfile;
  financials: FinancialData;
  keyStats: KeyStats;
  summaryDetail: SummaryDetail;
  recommendations: RecommendedSymbol[];
}

// ── 인증 헬퍼 ───────────────────────────────────────────────

function needsRefresh(expiresAt?: number | null): boolean {
  if (!expiresAt) return true;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return expiresAt <= nowInSeconds + TOKEN_REFRESH_LEEWAY_SECONDS;
}

async function resolveAccessToken(forceRefresh: boolean): Promise<string | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) return null;

  let activeSession = session;
  if (forceRefresh || needsRefresh(session.expires_at)) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) return null;
    activeSession = refreshed.session;
  }

  return activeSession.access_token;
}

// ── 공개 API ────────────────────────────────────────────────

/**
 * 종목의 심층 재무 데이터를 조회합니다 (quoteSummary + recommendations).
 * @param ticker 종목 티커
 * @param market US 또는 KR
 */
export async function fetchQuoteSummary(
  ticker: string,
  market: "US" | "KR",
): Promise<QuoteSummaryResponse | null> {
  try {
    if (!ticker) return null;

    const accessToken = await resolveAccessToken(false);
    if (!accessToken) return null;

    const { data, error } = await supabase.functions.invoke("fetch-quote-summary", {
      body: { ticker: ticker.toUpperCase(), market },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (error) {
      console.warn("[stock-summary] fetchQuoteSummary error:", error);
      return null;
    }

    return data as QuoteSummaryResponse;
  } catch (err) {
    console.warn("[stock-summary] fetchQuoteSummary failed:", err);
    return null;
  }
}
