# Portfolio Active Holding Deduplication

## Problem

The assets page rendered one table row per `portfolio_assets` row. Manual and AI asset registration always inserted a new active row, so repeated registration of the same `(portfolio_id, ticker, market)` appeared as duplicate holdings.

## Fix

- Added `src/lib/portfolio-assets.ts` with weighted-average merge logic.
- Manual registration now updates an existing active holding instead of inserting a duplicate.
- AI registration uses the same merge rule after confirmation.
- Existing duplicate active holdings are consolidated by a Supabase migration:
  - quantity is summed,
  - average price is recalculated as weighted average cost,
  - valuation records are repointed to the kept asset row,
  - duplicate asset rows are removed,
  - a partial unique index prevents future active duplicates per portfolio/ticker/market.

## Verification

- Added `tests/portfolio-assets.test.ts`.
- `npm test` runs all `tests/*.test.ts` files.
