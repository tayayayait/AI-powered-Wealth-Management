import { supabase } from "@/integrations/supabase/client";

const TOKEN_REFRESH_LEEWAY_SECONDS = 30;

export interface TickerSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  market: "US" | "KR";
  rawSymbol: string;
}

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
 * 종목 검색 — search-ticker Edge Function 호출
 * @param query 검색어 (종목명 또는 티커)
 * @param market 시장 필터 (선택)
 * @returns 검색 결과 배열
 */
export async function searchTicker(
  query: string,
  market?: "US" | "KR",
): Promise<TickerSearchResult[]> {
  try {
    if (!query || query.trim().length < 1) return [];

    const accessToken = await resolveAccessToken(false);
    if (!accessToken) return [];

    const body: Record<string, string> = { query: query.trim() };
    if (market) body.market = market;

    const { data, error } = await supabase.functions.invoke("search-ticker", {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (error) {
      console.warn("[stock-search] searchTicker error:", error);
      return [];
    }

    return (data as { results?: TickerSearchResult[] })?.results ?? [];
  } catch (err) {
    console.warn("[stock-search] searchTicker failed:", err);
    return [];
  }
}
