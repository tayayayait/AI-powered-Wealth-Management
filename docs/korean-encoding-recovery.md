# Dashboard Korean Encoding Recovery

## Date
- 2026-04-23

## Symptom
- Korean labels on the member dashboard were rendered as mojibake (garbled characters).
- Some string literals were corrupted in `format.ts`, causing invalid fallback text.

## Root Cause
- Source strings in `src/routes/_authenticated/dashboard.tsx` were saved with corrupted text data.
- Non-finite fallback strings in `src/lib/format.ts` were also damaged.

## Fix
- Rewrote all corrupted dashboard UI strings in `src/routes/_authenticated/dashboard.tsx` with valid Korean text.
- Restored invalid fallback literals in `src/lib/format.ts` to `"—"`.
- Saved both files in UTF-8 encoding.

## Result
- Korean labels render correctly on the dashboard.
- String fallback behavior in numeric/currency formatters is now valid again.