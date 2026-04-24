import { supabase } from "@/integrations/supabase/client";

const TOKEN_REFRESH_LEEWAY_SECONDS = 30;

export interface HistoricalDataPoint {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  adjClose: number | null;
}

export interface HistoricalResponse {
  ticker: string;
  market: "US" | "KR";
  period: string;
  interval: string;
  data: HistoricalDataPoint[];
}

export type HistoricalPeriod = "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "MAX";

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

/**
 * 과거 가격 데이터 조회 — fetch-historical Edge Function 호출
 * @param ticker 종목 티커
 * @param market US 또는 KR
 * @param period 조회 기간
 * @param interval 데이터 간격 (선택, 자동 결정)
 */
export async function fetchHistorical(
  ticker: string,
  market: "US" | "KR",
  period: HistoricalPeriod = "1Y",
  interval?: "1d" | "1wk" | "1mo",
): Promise<HistoricalResponse | null> {
  try {
    if (!ticker) return null;

    const accessToken = await resolveAccessToken(false);
    if (!accessToken) return null;

    const body: Record<string, string> = {
      ticker: ticker.toUpperCase(),
      market,
      period,
    };
    if (interval) body.interval = interval;

    const { data, error } = await supabase.functions.invoke("fetch-historical", {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (error) {
      console.warn("[stock-history] fetchHistorical error:", error);
      return null;
    }

    return data as HistoricalResponse;
  } catch (err) {
    console.warn("[stock-history] fetchHistorical failed:", err);
    return null;
  }
}
