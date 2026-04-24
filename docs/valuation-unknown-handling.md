# Valuation UNKNOWN Handling

## Date
- 2026-04-23

## Symptom
- Valuation view repeatedly showed `평가불가 (UNKNOWN)` for assets.
- Users could not tell whether this came from Yahoo sync failure, missing fundamentals, or invalid price data.

## Root Cause
- Existing valuation rule required both `EPS > 0` and `industry_per > 0`.
- Yahoo `quote` response can omit `epsTrailingTwelveMonths` or `trailingPE` for some tickers/markets.
- UI unknown section used a single generic reason (`펀더멘탈 데이터 없음`) and hid the specific failure cause.

## Changes
- Updated `src/lib/valuation.ts`:
  - If `EPS` is missing but `PER` exists, derive `EPS = currentPrice / PER`.
  - Emit explicit reason codes for unknown cases:
    - `MISSING_EPS`
    - `MISSING_INDUSTRY_PER`
    - `INVALID_PRICE`
    - `MISSING_FUNDAMENTALS`
  - Keep existing valuation bands/scoring when requirements are satisfied.

- Updated `supabase/functions/fetch-price/index.ts`:
  - Added numeric guards for quote values.
  - Added `quoteSummary` fallback modules (`defaultKeyStatistics`, `summaryDetail`, `financialData`) when quote-level `EPS/PER` is missing.
  - Added cross-derivation:
    - derive `EPS` from `PER`
    - derive `PER` from `EPS`
  - Persist `null` explicitly when still unavailable.

- Updated `src/routes/_authenticated/portfolio.valuation.tsx`:
  - Added reason mapping for unknown rows:
    - `SNAPSHOT_MISSING`, `PRICE_STALE`, `MISSING_EPS`, `MISSING_INDUSTRY_PER`, `INVALID_PRICE`, `MISSING_FUNDAMENTALS`
  - Unknown table now shows concrete causes instead of one generic message.

## Expected Result
- Fewer `UNKNOWN` bands when only one of `EPS/PER` is missing.
- Faster diagnosis when `UNKNOWN` remains (stale sync, missing snapshot, missing fundamentals, invalid price).
