/**
 * Gemini-based natural language intent parser.
 * Falls back to local parser when Gemini is disabled or unavailable.
 */
import type { ParsedIntent } from "./intent-parser";
import { normalizeIntentByUtterance, parseIntent as localParse } from "./intent-parser";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL ?? "gemini-1.5-flash";
const GEMINI_ENABLE_FLAG = import.meta.env.VITE_ENABLE_GEMINI_PARSER;
const GEMINI_ENABLED =
  GEMINI_ENABLE_FLAG == null ? true : GEMINI_ENABLE_FLAG.toLowerCase() === "true";
const GEMINI_DISABLE_STORAGE_KEY = "wealth:gemini-unavailable";

let geminiUnavailable =
  typeof window !== "undefined" &&
  window.localStorage.getItem(GEMINI_DISABLE_STORAGE_KEY) === "1";

const SYSTEM_PROMPT = `You parse Korean/English portfolio chat messages into JSON.
Return JSON only, no extra text.

{
  "intent_type": "ADD_ASSET" | "UPDATE_ASSET" | "REMOVE_ASSET" | "QUERY_PORTFOLIO" | "UNKNOWN",
  "confidence": 0.0 to 1.0,
  "items": [
    {
      "ticker": "AAPL",
      "market": "US" | "KR",
      "name": "Apple Inc.",
      "quantity": 10,
      "avg_price": 180
    }
  ],
  "summary": "short summary"
}`;

const VALID_INTENT_TYPES = new Set<ParsedIntent["intent_type"]>([
  "ADD_ASSET",
  "UPDATE_ASSET",
  "REMOVE_ASSET",
  "QUERY_PORTFOLIO",
  "UNKNOWN",
]);

function markGeminiUnavailable() {
  geminiUnavailable = true;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(GEMINI_DISABLE_STORAGE_KEY, "1");
  }
}

function shouldUseGemini() {
  return GEMINI_ENABLED && Boolean(GEMINI_API_KEY) && !geminiUnavailable;
}

function summarize(intent: ParsedIntent): string {
  const tickers = intent.items.map((item) => item.ticker).join(", ") || "N/A";
  return `${intent.intent_type} : ${tickers}`;
}

export async function parseIntentWithGemini(text: string): Promise<ParsedIntent> {
  if (!shouldUseGemini()) {
    return localParse(text);
  }

  const geminiUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent` +
    `?key=${GEMINI_API_KEY}`;

  try {
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${SYSTEM_PROMPT}\n\nUser text: "${text}"` }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      // Permanent auth/model errors should stop repeated failing requests.
      if ([400, 401, 403, 404].includes(response.status)) {
        markGeminiUnavailable();
      }
      console.warn("[gemini-parser] API error:", response.status);
      return localParse(text);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.warn("[gemini-parser] Empty response, falling back to local parser");
      return localParse(text);
    }

    let parsed: {
      intent_type?: string;
      confidence?: number;
      items?: Array<{
        ticker?: string;
        market?: string;
        name?: string;
        quantity?: number | null;
        avg_price?: number | null;
      }>;
      summary?: string;
    };

    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.warn("[gemini-parser] Invalid JSON response, falling back to local parser");
      return localParse(text);
    }

    const intent: ParsedIntent = {
      intent_type: VALID_INTENT_TYPES.has(parsed.intent_type as ParsedIntent["intent_type"])
        ? (parsed.intent_type as ParsedIntent["intent_type"])
        : "UNKNOWN",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item) => ({
            ticker: String(item.ticker ?? "").toUpperCase(),
            market: item.market === "KR" ? "KR" : "US",
            name: item.name ? String(item.name) : undefined,
            quantity: typeof item.quantity === "number" ? item.quantity : undefined,
            avg_price: typeof item.avg_price === "number" ? item.avg_price : undefined,
          }))
        : [],
      summary: parsed.summary,
    };

    const normalized = normalizeIntentByUtterance(text, intent);
    return {
      ...normalized,
      summary: normalized.summary ?? summarize(normalized),
    };
  } catch (error) {
    console.error("[gemini-parser] Request failed, falling back to local parser:", error);
    return localParse(text);
  }
}
