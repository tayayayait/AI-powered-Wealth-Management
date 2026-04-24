import { supabase } from "@/integrations/supabase/client";

export interface ParsedItem {
  ticker: string;
  market: "US" | "KR";
  name?: string;
  quantity?: number;
  avg_price?: number;
}

export interface ParsedIntent {
  intent_type: "ADD_ASSET" | "UPDATE_ASSET" | "REMOVE_ASSET" | "QUERY_PORTFOLIO" | "UNKNOWN";
  items: ParsedItem[];
  confidence: number;
  summary?: string;
}

const NAME_MAP: Record<string, { ticker: string; market: "US" | "KR" }> = {
  애플: { ticker: "AAPL", market: "US" },
  apple: { ticker: "AAPL", market: "US" },
  aapl: { ticker: "AAPL", market: "US" },
  마이크로소프트: { ticker: "MSFT", market: "US" },
  msft: { ticker: "MSFT", market: "US" },
  테슬라: { ticker: "TSLA", market: "US" },
  tesla: { ticker: "TSLA", market: "US" },
  tsla: { ticker: "TSLA", market: "US" },
  엔비디아: { ticker: "NVDA", market: "US" },
  nvda: { ticker: "NVDA", market: "US" },
  구글: { ticker: "GOOGL", market: "US" },
  googl: { ticker: "GOOGL", market: "US" },
  삼성전자: { ticker: "005930", market: "KR" },
  삼성: { ticker: "005930", market: "KR" },
  카카오: { ticker: "035720", market: "KR" },
  sk하이닉스: { ticker: "000660", market: "KR" },
  하이닉스: { ticker: "000660", market: "KR" },
};

const ACTION_INTENTS: Array<ParsedIntent["intent_type"]> = [
  "ADD_ASSET",
  "UPDATE_ASSET",
  "REMOVE_ASSET",
];

function findTicker(text: string): { ticker: string; market: "US" | "KR" } | null {
  const lower = text.toLowerCase();
  for (const key of Object.keys(NAME_MAP)) {
    if (lower.includes(key.toLowerCase())) return NAME_MAP[key];
  }

  const directTicker = text.match(/\b([A-Za-z]{1,5}|\d{6})\b/);
  if (directTicker) {
    const ticker = directTicker[1].toUpperCase();
    return { ticker, market: /^\d{6}$/.test(ticker) ? "KR" : "US" };
  }

  return null;
}

function isDeclarativeHoldingStatement(text: string, intent: ParsedIntent): boolean {
  const lower = text.toLowerCase();
  const qtyFromText = text.match(/(\d+(?:\.\d+)?)\s*주/);
  const hasTicker = intent.items.some((item) => item.ticker.length > 0);
  const hasQuantity =
    intent.items.some((item) => typeof item.quantity === "number" && item.quantity > 0) ||
    !!qtyFromText;

  if (!hasTicker || !hasQuantity) return false;
  if (!/(보유|보유중|보유하고|가지고|들고)/.test(lower)) return false;
  if (/(\?|조회|확인|얼마|몇|알려|보여|있나요|있는지|있어\?)/.test(lower)) return false;

  return true;
}

export function normalizeIntentByUtterance(text: string, intent: ParsedIntent): ParsedIntent {
  if (isDeclarativeHoldingStatement(text, intent)) {
    const qtyFromText = text.match(/(\d+(?:\.\d+)?)\s*주/);
    const quantity = qtyFromText ? Number(qtyFromText[1]) : undefined;
    const normalizedItems = intent.items.map((item, index) =>
      index === 0 && quantity != null && item.quantity == null ? { ...item, quantity } : item,
    );

    return {
      ...intent,
      items: normalizedItems,
      intent_type: "ADD_ASSET",
      confidence: Math.max(intent.confidence, 0.9),
      summary:
        intent.summary ??
        `ADD_ASSET · ${intent.items.map((item) => item.ticker).join(", ") || "N/A"}`,
    };
  }

  return intent;
}

export function parseIntent(text: string): ParsedIntent {
  const source = text.trim();
  const lower = source.toLowerCase();

  let intent_type: ParsedIntent["intent_type"] = "UNKNOWN";
  if (/(추가|매수|매입|buy|add)/.test(lower)) intent_type = "ADD_ASSET";
  else if (/(수정|변경|update|change)/.test(lower)) intent_type = "UPDATE_ASSET";
  else if (/(삭제|매도|제거|remove|sell)/.test(lower)) intent_type = "REMOVE_ASSET";
  else if (/(얼마|보유|있어|확인|조회|query|얼만큼|몇주)/.test(lower))
    intent_type = "QUERY_PORTFOLIO";

  const ticker = findTicker(source);
  const items: ParsedItem[] = [];
  let confidence = 0.5;

  if (ticker) {
    const qtyMatch = source.match(/(\d+(?:\.\d+)?)\s*주/);
    const priceMatch =
      source.match(/(\d+(?:\.\d+)?)\s*(달러|원|usd|krw|원에서)/i) ??
      source.match(/평단\s*(\d+(?:\.\d+)?)/i) ??
      source.match(/@\s*(\d+(?:\.\d+)?)/);

    items.push({
      ticker: ticker.ticker,
      market: ticker.market,
      quantity: qtyMatch ? Number(qtyMatch[1]) : undefined,
      avg_price: priceMatch ? Number(priceMatch[1]) : undefined,
    });

    confidence = 0.7;
    if (qtyMatch && (intent_type === "ADD_ASSET" || intent_type === "UPDATE_ASSET")) confidence = 0.9;
    if (intent_type === "REMOVE_ASSET") confidence = 0.9;
    if (intent_type === "QUERY_PORTFOLIO") confidence = 0.95;
  }

  if (ACTION_INTENTS.includes(intent_type) && items.length === 0) {
    intent_type = "UNKNOWN";
    confidence = 0.2;
  }

  if (intent_type === "UNKNOWN" && items.length === 0) confidence = 0.2;

  const normalized = normalizeIntentByUtterance(source, { intent_type, items, confidence });

  const summary =
    normalized.intent_type === "UNKNOWN"
      ? '의도를 파악하지 못했습니다. 예: "애플 5주 180달러로 추가"'
      : `${normalized.intent_type} · ${normalized.items.map((item) => item.ticker).join(", ") || "N/A"}`;

  return { ...normalized, summary: normalized.summary ?? summary };
}

export async function loadSupportedTickers() {
  const { data } = await supabase.from("price_snapshots").select("ticker,name");
  return data ?? [];
}
