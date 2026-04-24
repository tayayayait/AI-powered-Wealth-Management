# Auth 406 and Favicon 404 Fix

## Date
- 2026-04-23

## Issue
- Supabase profile lookup returned `406 Not Acceptable` from `/rest/v1/profiles`.
- Browser requested `/favicon.ico` and got `404 Not Found`.

## Root Cause
- Auth flow used `.single()` for `profiles` lookup. When profile row was missing, PostgREST returned 406.
- Project had no favicon assets under static public path.

## Changes
- Updated `src/lib/auth-context.tsx`:
  - Replaced `.single()` with `.maybeSingle()` in profile lookup path.
  - Added `getOrCreateProfile()` to auto-create missing `profiles` rows with `upsert`.
  - Added fallback display name resolver from user metadata/email.
- Updated `src/routes/__root.tsx`:
  - Added explicit favicon link: `/favicon.svg`.
- Added static assets:
  - `public/favicon.svg`
  - `public/favicon.ico` (placeholder to avoid 404)

## Expected Result
- Missing-profile users no longer trigger 406 during session init.
- Favicon request no longer returns 404.
