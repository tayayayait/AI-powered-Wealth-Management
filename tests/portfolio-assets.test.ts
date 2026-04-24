import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeAssetPosition } from "../src/lib/portfolio-assets.ts";

test("merges duplicate active holdings by summing quantity and weighted average cost", () => {
  const merged = mergeAssetPosition(
    { quantity: 4, avg_price: 100 },
    { quantity: 6, avg_price: 150 },
  );

  assert.deepEqual(merged, {
    quantity: 10,
    avg_price: 130,
  });
});

test("rejects invalid quantity when merging holdings", () => {
  assert.throws(
    () => mergeAssetPosition({ quantity: 1, avg_price: 100 }, { quantity: 0, avg_price: 120 }),
    /quantity must be greater than 0/,
  );
});
