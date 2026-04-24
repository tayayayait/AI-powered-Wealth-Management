# Supabase Edge + Yahoo Finance Auth Fix

## Date
- 2026-04-23

## Symptom
- `POST /functions/v1/fetch-price` returned `401 Unauthorized`.
- Response body:
  - `code: UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM`
  - `message: Unsupported JWT algorithm ES256`
- As a result, Yahoo Finance price sync did not update `price_snapshots`.

## Root Cause
- Edge Gateway-level JWT verification (`verify_jwt = true` default) rejected user access tokens signed with `ES256`.
- The function was blocked before Yahoo Finance logic executed.

## References
- Supabase docs indicate legacy `verify_jwt` path can be incompatible with new JWT signing keys.
- Recommended pattern is explicit auth verification inside function code.

## Changes
- Updated `supabase/config.toml`:
  - Added:
    - `[functions.fetch-price]`
    - `verify_jwt = false`
- Updated `supabase/functions/fetch-price/index.ts`:
  - Added robust bearer token parsing.
  - Added in-function user verification via:
    - `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`
    - `auth.getUser(token)`
  - Kept DB write path using service role key only after user auth passes.
  - Standardized JSON responses for `401`/`400`.

## Why This Is Correct
- Gateway JWT validation is bypassed for this function only.
- Auth is still enforced in-function using Supabase Auth.
- Works with asymmetric signing keys (`ES256`) while preserving access control.

## Operational Checklist
- Deploy function after config change:
  - `supabase functions deploy fetch-price`
- Confirm secrets exist in function runtime:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Re-test browser request:
  - Expect `200` or function-level `401` (not gateway algorithm error).

## 2026-04-23 Follow-up (Client Token Injection)

### Additional Symptom
- Browser console showed repeated:
  - `fetch-price:1 Failed to load resource: the server responded with a status of 401`
  - `FunctionsHttpError: Edge Function returned a non-2xx status code`

### Confirmed Cause
- `supabase.functions.invoke()` can fall back to a non-user bearer value when no valid user access token is attached at call time.
- The function-level `auth.getUser(token)` check then correctly rejects the request with `401`.

### Client Fix
- Updated `src/lib/stock-api.ts`:
  - `syncPrices()` now fetches `supabase.auth.getSession()` first.
  - If no `session.access_token` exists, it skips the function call and returns `0`.
  - When invoking `fetch-price`, it now explicitly sets:
    - `Authorization: Bearer <session.access_token>`

### Expected Result
- Authenticated users send a verified user JWT consistently.
- Random/initial-load `401` spikes from anon/publishable fallback are removed.

## 2026-04-23 Follow-up (Token Refresh + Retry + Dedup)

### Additional Symptom
- Browser showed repeated `401 Unauthorized` logs from `syncPrices()` calls across multiple authenticated screens.
- Failures were clustered around initial page loads and concurrent route-level sync triggers.

### Confirmed Cause
- Multiple pages can call `syncPrices()` at nearly the same time, creating duplicated Edge Function requests.
- A near-expiry or stale access token can intermittently fail function-level auth, returning `401`.

### Client Hardening Changes
- Updated `src/lib/stock-api.ts`:
  - Added access token freshness check using `expires_at` with a safety leeway.
  - Added forced `refreshSession()` path before call when token is near expiry.
  - Added one-time retry on `FunctionsHttpError` with status `401` after refreshing token.
  - Added in-flight deduplication for full sync (`syncPrices()` without arguments) to prevent concurrent duplicate calls.

### Expected Result
- Fewer duplicated network calls on page load.
- Reduced intermittent `401` responses caused by stale/expiring tokens.
- More stable first-load price synchronization behavior on authenticated routes.

## 2026-04-23 Follow-up (Missing Snapshot Recovery)

### Additional Symptom
- Some users had active `portfolio_assets` rows but no matching `price_snapshots`.
- In this case, valuation showed fallback prices (average price) and `MISSING_FUNDAMENTALS`.

### Confirmed Cause
- If initial asset registration happened while function auth failed (`401`), snapshot bootstrap could be skipped.
- Later full sync (`syncPrices()` without ticker) only read existing snapshots, so missing rows were never recovered.

### Function Fix
- Updated `supabase/functions/fetch-price/index.ts`:
  - On full sync, load authenticated user's active holdings (`portfolio_assets`).
  - Auto-create missing `price_snapshots` rows per `(ticker, market)`.
  - Restrict full-sync quote refresh scope to user holding tickers.

### Expected Result
- Existing users with previously skipped snapshots recover automatically on next sync.
- Current price/fundamental refresh resumes for holdings without manual re-registration.
