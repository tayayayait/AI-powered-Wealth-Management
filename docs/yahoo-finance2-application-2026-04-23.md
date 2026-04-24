# yahoo-finance2 Application Update

## Date

- 2026-04-23

## Reference Analyzed

- https://github.com/gadicc/yahoo-finance2

## Key Findings Applied

- `yahoo-finance2` should be called from server/edge runtime, not directly in browser.
- The package exposes quote, historical, quoteSummary, recommendationsBySymbol, and search modules already used by this project.
- Yahoo symbol handling for Korean assets can require exchange suffix variants (`.KS`, `.KQ`).

## Code Changes

- Added shared Yahoo module:
  - `supabase/functions/_shared/yahoo.ts`
  - Centralized `yahoo-finance2@2.11.3` import.
  - Added ticker candidate fallback helper:
    - KR: `TICKER.KS` -> `TICKER.KQ` -> `TICKER`
    - US: `TICKER`
- Updated Edge Functions to use shared Yahoo module:
  - `supabase/functions/fetch-price/index.ts`
  - `supabase/functions/fetch-historical/index.ts`
  - `supabase/functions/fetch-quote-summary/index.ts`
  - `supabase/functions/search-ticker/index.ts`

## Behavioral Impact

- Korean symbols that fail with `.KS` now retry with `.KQ` automatically.
- Yahoo client import/version is no longer duplicated across function files.
- Existing auth flow and response schema remain unchanged.

## Risk Notes

- Dependency remains pinned to `2.11.3` for compatibility with existing Supabase Edge runtime setup in this repository.
- No browser-side direct Yahoo calls were introduced.
