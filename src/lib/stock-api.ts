import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const TOKEN_REFRESH_LEEWAY_SECONDS = 30;
let inFlightFullSync: Promise<number> | null = null;

function buildSyncBody(
  ticker?: string,
  market?: "US" | "KR",
  name?: string,
): Record<string, string> {
  const body: Record<string, string> = {};
  if (ticker) body.ticker = ticker.toUpperCase();
  if (market) body.market = market;
  if (name) body.name = name;
  return body;
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

  if (sessionError) {
    console.warn("[stock-api] resolveAccessToken session error:", sessionError);
    return null;
  }

  if (!session?.access_token) {
    return null;
  }

  let activeSession = session;
  if (forceRefresh || needsRefresh(session.expires_at)) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      console.warn("[stock-api] resolveAccessToken refresh error:", refreshError);
      return null;
    }
    activeSession = refreshed.session;
  }

  return activeSession.access_token;
}

async function invokeFetchPrice(
  accessToken: string,
  body: Record<string, string>,
): Promise<{ data: { count?: number } | null; error: unknown }> {
  const { data, error } = await supabase.functions.invoke("fetch-price", {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return { data: data as { count?: number } | null, error };
}

function isUnauthorizedFunctionError(error: unknown): error is FunctionsHttpError {
  return error instanceof FunctionsHttpError && error.context.status === 401;
}

async function logFunctionError(error: unknown): Promise<void> {
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    try {
      const payload = await error.context.clone().json();
      console.warn("[stock-api] syncPrices error:", { status, payload });
      return;
    } catch {
      const payload = await error.context.clone().text();
      console.warn("[stock-api] syncPrices error:", { status, payload });
      return;
    }
  }

  console.warn("[stock-api] syncPrices error:", error);
}

function isFullSync(ticker?: string, market?: "US" | "KR", name?: string): boolean {
  return !ticker && !market && !name;
}

async function executeSync(
  ticker?: string,
  market?: "US" | "KR",
  name?: string,
): Promise<number> {
  const body = buildSyncBody(ticker, market, name);

  let accessToken = await resolveAccessToken(false);
  if (!accessToken) {
    return 0;
  }

  let { data, error } = await invokeFetchPrice(accessToken, body);

  if (isUnauthorizedFunctionError(error)) {
    accessToken = await resolveAccessToken(true);
    if (!accessToken) {
      return 0;
    }
    ({ data, error } = await invokeFetchPrice(accessToken, body));
  }

  if (error) {
    await logFunctionError(error);
    return 0;
  }

  return data?.count ?? 0;
}

export async function syncPrices(
  ticker?: string,
  market?: "US" | "KR",
  name?: string,
): Promise<number> {
  try {
    if (isFullSync(ticker, market, name)) {
      if (!inFlightFullSync) {
        inFlightFullSync = executeSync().finally(() => {
          inFlightFullSync = null;
        });
      }
      return await inFlightFullSync;
    }

    return await executeSync(ticker, market, name);
  } catch (err) {
    console.warn("[stock-api] syncPrices failed:", err);
    return 0;
  }
}

export async function ensureAndSync(
  ticker: string,
  market: "US" | "KR",
  name?: string,
): Promise<void> {
  await syncPrices(ticker, market, name).catch(() => {});
}

export async function getLastSyncTime(): Promise<string | null> {
  const { data } = await supabase
    .from("price_snapshots")
    .select("last_synced_at")
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.last_synced_at ?? null;
}

/**
 * 최근 동기화된 USD/KRW 환율을 조회합니다.
 * fetch-price Edge Function이 동기화할 때 price_snapshots에 환율이 저장됩니다.
 * @returns 환율 (예: 1380.50) 또는 null
 */
export async function getExchangeRate(): Promise<number | null> {
  const { data } = await supabase
    .from("price_snapshots")
    .select("exchange_rate")
    .not("exchange_rate", "is", null)
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as { exchange_rate?: number } | null)?.exchange_rate ?? null;
}

