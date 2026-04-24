# Chatbot Gemini + Yahoo Sync Recovery

## Date
- 2026-04-23

## Symptom
- Entering a ticker through chatbot flow created assets, but:
  - Yahoo Finance price sync was not executed.
  - Gemini parser was not used even with `VITE_GEMINI_API_KEY` set.
- Result:
  - `price_snapshots.current_price` stayed `0` for new rows.
  - valuation was frequently `UNKNOWN`.

## Root Cause
- `src/components/ChatbotPanel.tsx`
  - `await ensureAndSync(ticker, item.market, item.name);` was appended to a `//` comment line.
  - The call was effectively commented out and never executed.
- `src/lib/gemini-parser.ts`
  - Gemini usage required `VITE_ENABLE_GEMINI_PARSER === "true"`.
  - In environments where the flag was omitted, Gemini stayed disabled even when API key existed.

## Changes
- `src/components/ChatbotPanel.tsx`
  - Restored real execution of `await ensureAndSync(...)`.
  - Added market filter to snapshot lookup:
    - `.eq("market", item.market)`
  - This prevents wrong snapshot selection when same ticker exists across markets.
- `src/lib/gemini-parser.ts`
  - Changed enable logic to:
    - default enabled when flag is not provided
    - disabled only when explicitly configured otherwise
  - Gemini is still gated by API key presence and runtime failure fallback.

## Expected Result
- Chatbot asset registration now triggers Yahoo price sync before DB insert.
- Gemini parser is used by default when API key is configured.
- New assets should receive non-zero price/fundamental data as soon as upstream data is available.
