# Auth Profile Bootstrap and 406 Handling

## Symptoms

- Browser console shows `406 (Not Acceptable)` on:
  - `GET /rest/v1/profiles?...`
- Browser console shows `GET /favicon.ico 404 (Not Found)`.

## Root Cause

- Supabase `.single()` requires exactly one row.
- If `profiles` has no row for the authenticated user (or RLS returns zero rows), PostgREST returns 406.
- Static favicon files were missing, so the browser requested `/favicon.ico` and received 404.

## Changes

- Added profile bootstrap helper:
  - `src/lib/profile.ts`
  - Uses `.maybeSingle()` for `profiles` query.
  - If no row exists, performs `upsert` with fallback `email` and `display_name`.
- Updated My Page profile loading to use bootstrap helper:
  - `src/routes/_authenticated/mypage.tsx`
- Updated withdraw flow to set profile status:
  - `status: "suspended"` on withdraw.
- Added favicon assets:
  - `public/favicon.svg`
  - `public/favicon.ico`

## Operational Notes

- If 406 appears again, verify:
  - User has a corresponding row in `public.profiles`.
  - RLS policies still allow users to select their own profile (`auth.uid() = id`).
