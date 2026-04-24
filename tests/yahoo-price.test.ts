import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isYahooRateLimitError,
  parseYahooChartQuote,
  shouldSkipPriceRefresh,
} from "../supabase/functions/_shared/yahoo-price.ts";

test("detects Yahoo text rate-limit responses surfaced as JSON parse errors", () => {
  const error = new Error(
    'invalid json response body reason: Unexpected token "T", "Too Many Requests " is not valid JSON',
  );

  assert.equal(isYahooRateLimitError(error), true);
});

test("parses chart quote payload without requiring crumb-based quote endpoint", () => {
  const quote = parseYahooChartQuote(
    {
      chart: {
        result: [
          {
            meta: {
              currency: "USD",
              regularMarketPrice: 305.33,
              previousClose: 304,
              shortName: "Advanced Micro Devices, Inc.",
            },
          },
        ],
      },
    },
    "AMD",
  );

  assert.deepEqual(quote, {
    currentPrice: 305.33,
    prevClose: 304,
    currency: "USD",
    shortName: "Advanced Micro Devices, Inc.",
  });
});

test("skips recent healthy snapshots to avoid repeated Yahoo calls", () => {
  const now = Date.parse("2026-04-24T10:00:00.000Z");

  assert.equal(
    shouldSkipPriceRefresh(
      {
        current_price: 305.33,
        is_stale: false,
        last_synced_at: "2026-04-24T09:50:00.000Z",
      },
      now,
    ),
    true,
  );
});

test("does not skip stale or zero-price snapshots", () => {
  const now = Date.parse("2026-04-24T10:00:00.000Z");

  assert.equal(
    shouldSkipPriceRefresh(
      {
        current_price: 0,
        is_stale: true,
        last_synced_at: "2026-04-24T09:59:00.000Z",
      },
      now,
    ),
    false,
  );
});
