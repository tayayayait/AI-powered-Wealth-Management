// Valuation rule engine v1: PER-relative fair value
import type { Database } from "@/integrations/supabase/types";

type Band = Database["public"]["Enums"]["valuation_band"];

export interface ValuationInput {
  currentPrice: number;
  eps: number | null;
  per: number | null;
  industryPer: number | null;
}

export interface ValuationOutput {
  fairValue: number | null;
  gapPercent: number | null;
  score: number | null;
  band: Band;
  reasonCodes: string[];
}

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function computeValuation(input: ValuationInput): ValuationOutput {
  const reasons = new Set<string>();
  const currentPrice = input.currentPrice;
  let eps = input.eps;
  const per = input.per;
  const industryPer = input.industryPer;

  if (!isPositiveNumber(eps) && isPositiveNumber(per) && isPositiveNumber(currentPrice)) {
    eps = currentPrice / per;
    reasons.add("EPS_DERIVED_FROM_PER");
  }

  if (!isPositiveNumber(currentPrice) || !isPositiveNumber(eps) || !isPositiveNumber(industryPer)) {
    if (!isPositiveNumber(currentPrice)) reasons.add("INVALID_PRICE");
    if (!isPositiveNumber(eps)) reasons.add("MISSING_EPS");
    if (!isPositiveNumber(industryPer)) reasons.add("MISSING_INDUSTRY_PER");
    if (reasons.size === 0) reasons.add("MISSING_FUNDAMENTALS");
    return { fairValue: null, gapPercent: null, score: null, band: "UNKNOWN", reasonCodes: [...reasons] };
  }

  const fairValue = eps * industryPer;
  const gap = (fairValue - currentPrice) / currentPrice; // positive = undervalued
  const gapPercent = gap * 100;

  let band: Band;
  if (gap > 0.15) { band = "UNDERVALUED"; reasons.add("PRICE_BELOW_FAIR"); }
  else if (gap < -0.15) { band = "OVERVALUED"; reasons.add("PRICE_ABOVE_FAIR"); }
  else { band = "FAIR"; reasons.add("PRICE_NEAR_FAIR"); }

  if (isPositiveNumber(per) && isPositiveNumber(industryPer)) {
    if (per < industryPer * 0.85) reasons.add("PER_DISCOUNT_VS_INDUSTRY");
    else if (per > industryPer * 1.15) reasons.add("PER_PREMIUM_VS_INDUSTRY");
  }

  // Score 0-100, 50 = fair, capped
  const raw = 50 + gap * 100;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return { fairValue, gapPercent, score, band, reasonCodes: [...reasons] };
}

export const BAND_LABEL: Record<Band, string> = {
  UNDERVALUED: "저평가",
  FAIR: "적정",
  OVERVALUED: "고평가",
  UNKNOWN: "평가불가",
};

export const BAND_COLOR: Record<Band, string> = {
  UNDERVALUED: "bg-success/15 text-success border-success/30",
  FAIR: "bg-info/15 text-info border-info/30",
  OVERVALUED: "bg-destructive/15 text-destructive border-destructive/30",
  UNKNOWN: "bg-muted text-muted-foreground border-border",
};

// ── Phase 2: 멀티팩터 밸류에이션 ──────────────────────────────

export interface MultiFactorInput {
  currentPrice: number;
  eps: number | null;
  per: number | null;
  industryPer: number | null;
  // quoteSummary 추가 데이터
  bookValue: number | null;        // BPS (주당순자산)
  priceToBook: number | null;      // PBR
  pegRatio: number | null;         // PEG
  targetMeanPrice: number | null;  // 애널리스트 평균 목표가
  forwardEps: number | null;       // 향후 EPS
  forwardPE: number | null;        // 향후 PER
  returnOnEquity: number | null;   // ROE
  dividendYield: number | null;    // 배당수익률
}

export interface FactorResult {
  name: string;
  label: string;
  fairValue: number | null;
  gapPercent: number | null;
  score: number | null;
  weight: number;
  reasonCodes: string[];
}

export interface MultiFactorOutput {
  // 개별 팩터 결과
  factors: FactorResult[];
  // 종합 결과
  compositeFairValue: number | null;
  compositeGapPercent: number | null;
  compositeScore: number | null;
  compositeBand: Band;
  reasonCodes: string[];
}

function clampScore(raw: number): number {
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function gapToScore(gap: number): number {
  // gap이 양수면 저평가 → 점수↑, 음수면 고평가 → 점수↓
  return clampScore(50 + gap * 100);
}

function gapToBand(gap: number): Band {
  if (gap > 0.15) return "UNDERVALUED";
  if (gap < -0.15) return "OVERVALUED";
  return "FAIR";
}

/**
 * 팩터 1: PER 기반 적정가 (기존 로직과 동일)
 */
function computePerFactor(input: MultiFactorInput): FactorResult {
  const reasons: string[] = [];
  let eps = input.eps;
  const per = input.per;
  const industryPer = input.industryPer;
  const price = input.currentPrice;

  if (!isPositiveNumber(eps) && isPositiveNumber(per) && isPositiveNumber(price)) {
    eps = price / per;
    reasons.push("EPS_DERIVED_FROM_PER");
  }

  if (!isPositiveNumber(price) || !isPositiveNumber(eps) || !isPositiveNumber(industryPer)) {
    return { name: "per", label: "PER 밸류에이션", fairValue: null, gapPercent: null, score: null, weight: 0, reasonCodes: ["MISSING_PER_DATA"] };
  }

  const fairValue = eps * industryPer;
  const gap = (fairValue - price) / price;

  if (isPositiveNumber(per) && isPositiveNumber(industryPer)) {
    if (per < industryPer * 0.85) reasons.push("PER_DISCOUNT");
    else if (per > industryPer * 1.15) reasons.push("PER_PREMIUM");
  }

  return { name: "per", label: "PER 밸류에이션", fairValue, gapPercent: gap * 100, score: gapToScore(gap), weight: 0.35, reasonCodes: reasons };
}

/**
 * 팩터 2: PBR 기반 적정가
 */
function computePbrFactor(input: MultiFactorInput): FactorResult {
  const reasons: string[] = [];
  const price = input.currentPrice;
  const pbr = input.priceToBook;
  const bps = input.bookValue;

  if (!isPositiveNumber(price) || !isPositiveNumber(bps)) {
    return { name: "pbr", label: "PBR 밸류에이션", fairValue: null, gapPercent: null, score: null, weight: 0, reasonCodes: ["MISSING_PBR_DATA"] };
  }

  // 업종 평균 PBR 대신 적정 PBR 1.0~1.5 기준 (ROE 반영)
  const roe = input.returnOnEquity;
  let targetPbr = 1.0;
  if (isPositiveNumber(roe)) {
    // ROE 기반 적정 PBR: PBR = ROE / 할인율(10%) 근사
    targetPbr = Math.max(0.5, Math.min(5, roe / 0.10));
    reasons.push("PBR_ADJUSTED_BY_ROE");
  }

  const fairValue = bps * targetPbr;
  const gap = (fairValue - price) / price;

  if (isPositiveNumber(pbr)) {
    if (pbr < 1.0) reasons.push("PBR_BELOW_1");
    else if (pbr > 3.0) reasons.push("PBR_HIGH");
  }

  return { name: "pbr", label: "PBR 밸류에이션", fairValue, gapPercent: gap * 100, score: gapToScore(gap), weight: 0.20, reasonCodes: reasons };
}

/**
 * 팩터 3: PEG 기반 판단
 */
function computePegFactor(input: MultiFactorInput): FactorResult {
  const reasons: string[] = [];
  const price = input.currentPrice;
  const peg = input.pegRatio;

  if (!isPositiveNumber(price) || !isPositiveNumber(peg)) {
    return { name: "peg", label: "PEG 밸류에이션", fairValue: null, gapPercent: null, score: null, weight: 0, reasonCodes: ["MISSING_PEG_DATA"] };
  }

  // PEG < 1: 저평가, PEG = 1: 적정, PEG > 1: 고평가
  const gap = (1 - peg) * 0.3; // 스케일 조정
  const score = gapToScore(gap);

  if (peg < 0.8) reasons.push("PEG_STRONG_UNDERVALUED");
  else if (peg < 1.0) reasons.push("PEG_UNDERVALUED");
  else if (peg > 2.0) reasons.push("PEG_OVERVALUED");
  else if (peg > 1.5) reasons.push("PEG_SLIGHTLY_OVERVALUED");
  else reasons.push("PEG_FAIRLY_VALUED");

  return { name: "peg", label: "PEG 밸류에이션", fairValue: null, gapPercent: gap * 100, score, weight: 0.15, reasonCodes: reasons };
}

/**
 * 팩터 4: 애널리스트 타겟가 기반
 */
function computeAnalystFactor(input: MultiFactorInput): FactorResult {
  const reasons: string[] = [];
  const price = input.currentPrice;
  const target = input.targetMeanPrice;

  if (!isPositiveNumber(price) || !isPositiveNumber(target)) {
    return { name: "analyst", label: "애널리스트 목표가", fairValue: null, gapPercent: null, score: null, weight: 0, reasonCodes: ["MISSING_ANALYST_DATA"] };
  }

  const gap = (target - price) / price;

  if (gap > 0.20) reasons.push("ANALYST_STRONG_UPSIDE");
  else if (gap > 0.05) reasons.push("ANALYST_UPSIDE");
  else if (gap < -0.10) reasons.push("ANALYST_DOWNSIDE");
  else reasons.push("ANALYST_NEAR_TARGET");

  return { name: "analyst", label: "애널리스트 목표가", fairValue: target, gapPercent: gap * 100, score: gapToScore(gap), weight: 0.30, reasonCodes: reasons };
}

/**
 * 멀티팩터 종합 밸류에이션
 * PER(35%), Analyst(30%), PBR(20%), PEG(15%) 가중 평균
 */
export function computeMultiFactorValuation(input: MultiFactorInput): MultiFactorOutput {
  const factors = [
    computePerFactor(input),
    computePbrFactor(input),
    computePegFactor(input),
    computeAnalystFactor(input),
  ];

  // 유효한 팩터만 가중 평균
  const validFactors = factors.filter((f) => f.score !== null);

  if (validFactors.length === 0) {
    return {
      factors,
      compositeFairValue: null,
      compositeGapPercent: null,
      compositeScore: null,
      compositeBand: "UNKNOWN",
      reasonCodes: ["NO_VALID_FACTORS"],
    };
  }

  // 가중치 재정규화
  const totalWeight = validFactors.reduce((sum, f) => sum + f.weight, 0);
  const compositeScore = clampScore(
    validFactors.reduce((sum, f) => sum + (f.score! * f.weight) / totalWeight, 0),
  );

  // 유효한 fairValue들의 가중 평균
  const fairValueFactors = validFactors.filter((f) => f.fairValue !== null);
  const fairValueWeight = fairValueFactors.reduce((sum, f) => sum + f.weight, 0);
  const compositeFairValue = fairValueWeight > 0
    ? fairValueFactors.reduce((sum, f) => sum + (f.fairValue! * f.weight) / fairValueWeight, 0)
    : null;

  const compositeGapPercent = compositeFairValue && isPositiveNumber(input.currentPrice)
    ? ((compositeFairValue - input.currentPrice) / input.currentPrice) * 100
    : null;

  const compositeGap = compositeGapPercent !== null ? compositeGapPercent / 100 : 0;
  const compositeBand = compositeGapPercent !== null ? gapToBand(compositeGap) : "UNKNOWN";

  const allReasons = validFactors.flatMap((f) => f.reasonCodes);
  allReasons.push(`FACTORS_USED_${validFactors.length}_OF_${factors.length}`);

  return {
    factors,
    compositeFairValue,
    compositeGapPercent,
    compositeScore,
    compositeBand,
    reasonCodes: allReasons,
  };
}

