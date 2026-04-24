# Auth Login Navigation Race Fix

## Date
- 2026-04-24

## Symptom
- After a successful email/password login, the success toast appeared.
- The URL changed to `/dashboard`, but the login form could remain visible instead of the member dashboard.

## Root Cause
- `signInWithPassword()` resolved before `AuthProvider` finished applying the new Supabase session to local React state.
- The protected `_authenticated` layout could evaluate `loading=false` and `isAuthenticated=false` during that gap.
- This created a race between login navigation and auth context hydration.

## Change
- Updated `src/lib/auth-context.tsx`.
- `signIn()` now sets `loading=true`, waits for Supabase auth, then calls `handleSession(data.session)` before returning.
- `signUp()` follows the same session handling path.
- `onAuthStateChange()` now sets `loading=true` before resolving the next session.

## Expected Result
- Login navigation waits until the auth context has the new session.
- Protected routes show the loading state during session hydration instead of treating the user as logged out.
