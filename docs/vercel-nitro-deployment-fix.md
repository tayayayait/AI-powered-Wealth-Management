# Vercel Nitro Deployment Fix

## Problem

Vercel deployed successfully, but the deployed URL returned `404: NOT_FOUND`.

## Cause

The project build was producing Cloudflare Workers output. The generated server output included `wrangler.json` and a worker entry, while `dist/client` did not include an `index.html` that Vercel could serve as a static Vite app.

TanStack Start needs a supported deployment adapter for Vercel. Vercel's TanStack Start deployment path uses Nitro.

## Fix

- Added `nitro` and its `jiti` peer dependency.
- Disabled the automatic Cloudflare build plugin in `vite.config.ts`.
- Added the Nitro Vite plugin.
- Added `vercel.json` with the `tanstack-start` framework preset.

## Verification

`pnpm run build` now generates `.output/public` and `.output/server`, which are Nitro deployment outputs instead of Cloudflare Workers-only output.

Run before deploying:

```bash
pnpm run build
npm test
```
