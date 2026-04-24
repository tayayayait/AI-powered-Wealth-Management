# Auth Demo Auto Login

## Date
- 2026-04-24

## Scope
- Applies to the public `/login` page only.
- Does not change `/admin/login`.

## Behavior
- When an unauthenticated visitor opens `/login`, the app automatically signs in with the client demo account and navigates to `/dashboard`.
- Existing Supabase session persistence remains unchanged.
- If auto login fails, the normal email/password form remains usable.

## Manual Login Bypass
- Open `/login?manual=1` to disable the automatic attempt for that page load.

## Implementation
- `src/lib/demo-auto-login.ts` owns the demo credentials and gating logic.
- `src/routes/login.tsx` calls the helper from a mount effect and keeps the existing submit flow for fallback manual login.
- `tests/demo-auto-login.test.ts` covers the credentials helper and auto-login gating conditions.
