# Vercel Query Core Resolution Fix

## Problem

Vercel production builds failed during `pnpm run build` with Rollup unable to resolve `@tanstack/query-core` from `@tanstack/react-query`.

The failure appears only after a clean pnpm install. Existing local installs can pass if `node_modules/@tanstack/query-core` is already present at the project root.

## Cause

The Vite/TanStack config dedupes TanStack packages, so `@tanstack/query-core` must be resolvable from the project root during bundling. It was only installed as a transitive dependency of `@tanstack/react-query`, which is insufficient under a clean pnpm layout.

## Fix

Declare `@tanstack/query-core` as a direct runtime dependency pinned to the version used by `@tanstack/react-query`:

```json
"@tanstack/query-core": "5.99.2"
```

## Verification

Run these commands from a clean checkout:

```bash
pnpm install --frozen-lockfile
pnpm run build
npm test
```
