const PORTFOLIO_DECIMAL_SCALE = 4;
const PORTFOLIO_DECIMAL_FACTOR = 10 ** PORTFOLIO_DECIMAL_SCALE;

export interface AssetPositionInput {
  quantity: number | string;
  avg_price: number | string;
}

export interface MergedAssetPosition {
  quantity: number;
  avg_price: number;
}

function toFiniteNumber(value: number | string, field: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${field} must be a finite number`);
  }
  return numeric;
}

function roundPortfolioDecimal(value: number): number {
  return Math.round((value + Number.EPSILON) * PORTFOLIO_DECIMAL_FACTOR) / PORTFOLIO_DECIMAL_FACTOR;
}

export function mergeAssetPosition(
  existing: AssetPositionInput,
  incoming: AssetPositionInput,
): MergedAssetPosition {
  const existingQuantity = toFiniteNumber(existing.quantity, "quantity");
  const incomingQuantity = toFiniteNumber(incoming.quantity, "quantity");
  const existingAvgPrice = toFiniteNumber(existing.avg_price, "avg_price");
  const incomingAvgPrice = toFiniteNumber(incoming.avg_price, "avg_price");

  if (existingQuantity <= 0 || incomingQuantity <= 0) {
    throw new Error("quantity must be greater than 0");
  }

  if (existingAvgPrice < 0 || incomingAvgPrice < 0) {
    throw new Error("avg_price must be greater than or equal to 0");
  }

  const quantity = roundPortfolioDecimal(existingQuantity + incomingQuantity);
  const avgPrice = roundPortfolioDecimal(
    (existingQuantity * existingAvgPrice + incomingQuantity * incomingAvgPrice) / quantity,
  );

  return {
    quantity,
    avg_price: avgPrice,
  };
}
