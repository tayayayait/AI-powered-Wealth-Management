# Yahoo Finance Rate Limit Recovery

## Date
- 2026-04-24

## Symptom
- `fetch-price` Edge Function logs showed:
  - `Too Many Requests`
  - `Unexpected token 'T', "Too Many Requests " is not valid JSON`
- `price_snapshots.current_price` stayed `0`.
- Assets were marked stale and valuation stayed unavailable.

## Root Cause
- `fetch-price` used `yahoo-finance2.quote()`, which calls Yahoo's crumb-based `query2.finance.yahoo.com/v7/finance/quote` endpoint.
- Yahoo returned a plain-text rate-limit response instead of JSON.
- The app had also been calling Yahoo repeatedly on page entry and manual refresh.

## Changes
- Added `supabase/functions/_shared/yahoo-price.ts`:
  - Uses Yahoo chart endpoint:
    - `query1.finance.yahoo.com/v8/finance/chart/{symbol}`
  - Detects `429` and `Too Many Requests` responses.
  - Parses chart quote payloads without requiring crumb/cookie flow.
  - Skips recent healthy snapshots for 15 minutes.
- Updated `supabase/functions/fetch-price/index.ts`:
  - Uses chart endpoint for current price and USD/KRW.
  - Stops the loop after a Yahoo rate-limit response instead of continuing to hit Yahoo.
  - Keeps stale marking but preserves the last known price in response metadata.
  - Checks DB update errors and retries with base columns if optional columns are absent.
- Added tests for:
  - Yahoo rate-limit detection.
  - Chart quote parsing.
  - Recent snapshot cache skipping.
  - Stale/zero-price refresh behavior.

## Operational Notes
- Local code is fixed, but production requires deploying the Edge Function:
  - `supabase functions deploy fetch-price`
- If `exchange_rate` is required for mixed USD/KRW dashboards, the remote DB should either have that column or the fallback path will skip it and update only base price fields.
