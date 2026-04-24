-- Merge duplicate active holdings and enforce one active row per portfolio/ticker/market.
WITH duplicate_groups AS (
  SELECT
    portfolio_id,
    user_id,
    upper(ticker) AS ticker,
    market,
    (array_agg(id ORDER BY created_at ASC, id ASC))[1] AS keep_id,
    array_agg(id ORDER BY created_at ASC, id ASC) AS asset_ids,
    sum(quantity) AS quantity,
    CASE
      WHEN sum(quantity) > 0 THEN sum(quantity * avg_price) / sum(quantity)
      ELSE max(avg_price)
    END AS avg_price,
    (array_agg(name ORDER BY updated_at DESC, created_at DESC, id DESC))[1] AS name,
    (array_agg(currency ORDER BY updated_at DESC, created_at DESC, id DESC))[1] AS currency
  FROM public.portfolio_assets
  WHERE status = 'active'
  GROUP BY portfolio_id, user_id, upper(ticker), market
  HAVING count(*) > 1
),
duplicate_assets AS (
  SELECT
    keep_id,
    unnest(asset_ids[2:cardinality(asset_ids)]) AS duplicate_id
  FROM duplicate_groups
),
updated_assets AS (
  UPDATE public.portfolio_assets AS pa
  SET
    ticker = dg.ticker,
    quantity = dg.quantity,
    avg_price = round(dg.avg_price, 4),
    name = dg.name,
    currency = dg.currency
  FROM duplicate_groups AS dg
  WHERE pa.id = dg.keep_id
  RETURNING pa.id
),
updated_valuations AS (
  UPDATE public.valuation_results AS vr
  SET asset_id = da.keep_id
  FROM duplicate_assets AS da
  WHERE vr.asset_id = da.duplicate_id
  RETURNING vr.id
)
DELETE FROM public.portfolio_assets AS pa
USING duplicate_assets AS da
WHERE pa.id = da.duplicate_id;

UPDATE public.portfolio_assets
SET ticker = upper(ticker)
WHERE ticker <> upper(ticker);

CREATE UNIQUE INDEX IF NOT EXISTS portfolio_assets_one_active_symbol_market_idx
ON public.portfolio_assets (portfolio_id, upper(ticker), market)
WHERE status = 'active';
