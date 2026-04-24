# Dashboard Market Currency Basis

## Date
- 2026-04-24

## Symptom
- Portfolio dashboard KPI cards always formatted totals as KRW.
- US holdings entered in USD could show values such as `₩1,520` instead of `$1,520.00`.

## Change
- Added `src/lib/portfolio-currency.ts`.
- Dashboard now resolves display currency from active holdings:
  - All `US` holdings: `USD`
  - All `KR` holdings: `KRW`
  - Mixed holdings: portfolio `base_currency`
- Dashboard KPI totals, trend chart, pie chart, and chart tooltips use the resolved display currency.
- Mixed-currency conversion uses the latest stored USD/KRW exchange rate when available.

## Expected Result
- A US-only portfolio dashboard displays totals in dollars.
- A KR-only portfolio dashboard displays totals in won.
- Mixed portfolios are aggregated using the portfolio base currency.
