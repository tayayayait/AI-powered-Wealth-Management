# Dashboard Duplicate Key Fix

## Date
- 2026-04-23

## Symptom
- React warning:
  - `Encountered two children with the same key, 'AAPL'`
  - `Encountered two children with the same key, 'TSLA'`
- Warning was emitted in dashboard pie legend rendering.

## Root Cause
- Dashboard pie legend used `key={d.name}` where `d.name` is ticker.
- When user has multiple holdings with the same ticker, keys collide.

## Fix
- Updated `src/routes/_authenticated/dashboard.tsx`:
  - `pieData` now includes per-asset `id`.
  - Pie legend item key changed from ticker-based key to asset `id`.

## Result
- Duplicate key warnings are removed for repeated holdings with identical tickers.
