# AI Chatbot Asset Registration Button

## Scope

This document explains how the `AI로 자산 등록` button opens the floating chatbot and pre-fills sample text.

## Behavior

- The button on dashboard empty state opens chatbot.
- The button on assets page toolbar opens chatbot.
- Both buttons prefill the input with `애플 주식 10주 보유`.
- Input like `애플 주식 10주 보유` is treated as `ADD_ASSET` (registration), not `QUERY_PORTFOLIO`.
- For `ADD_ASSET`-style requests, chatbot validates `종목명`, `보유 수량`, `평균단가` before creating a pending intent.
- If required values are missing, chatbot responds in-chat with explicit guidance, e.g. `다음 항목을 입력해주세요: 종목명과 평균단가`.
- The same chat bubble renders inline input fields for the missing values, and user can submit them without retyping the whole sentence.
- Query phrasing such as `AAPL 보유하고 있어?` stays as portfolio query.
- Lowercase tickers like `tqqq` are normalized and parsed as `TQQQ`.
- If user has no `portfolios` row yet, a default portfolio is created automatically before saving assets.
- Gemini parsing runs only when `VITE_ENABLE_GEMINI_PARSER=true` and API key is present.
- If Gemini returns permanent API errors (`400/401/403/404`), parser falls back to local parsing and disables Gemini for the browser session/device (via localStorage flag) to stop repeated failing requests.
- AI confirm now marks chat as `failed` when zero assets are actually written.
- If `price_snapshots` has no row for a ticker, asset registration still proceeds using user input (`ticker/name/avg_price`) and default currency by market (`KRW` or `USD`).

## Implementation

- Event name is defined in `src/lib/chatbot-launcher.ts` as `wealth:chatbot-open`.
- `openChatbot()` dispatches a browser `CustomEvent` with optional `{ prefill }`.
- `src/components/ChatbotPanel.tsx` listens to this event and:
  - opens the panel
  - sets input text when `prefill` exists
  - validates missing registration fields and returns a chat message when required values are not provided
  - renders inline inputs for missing fields and reprocesses the request after user fills and submits
- `src/lib/intent-parser.ts` normalizes declarative holding statements to `ADD_ASSET`.
- `src/lib/gemini-parser.ts` applies the same normalization after Gemini parsing.
- `src/lib/portfolio.ts` ensures portfolio lookup uses `getOrCreatePortfolio(userId)` instead of `.single()` on potentially empty data.

## File References

- `src/lib/chatbot-launcher.ts`
- `src/components/ChatbotPanel.tsx`
- `src/routes/_authenticated/dashboard.tsx`
- `src/routes/_authenticated/portfolio.assets.tsx`
- `src/lib/intent-parser.ts`
- `src/lib/gemini-parser.ts`
- `src/lib/portfolio.ts`
