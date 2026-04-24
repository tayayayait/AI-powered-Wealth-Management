import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatPercent, pnlColor } from "@/lib/format";
import { computeValuation, BAND_LABEL, BAND_COLOR } from "@/lib/valuation";
import { syncPrices } from "@/lib/stock-api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import { Award, TrendingDown, FileText, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/portfolio/valuation")({ component: ValuationPage });

const BAND_ORDER = { UNDERVALUED: 0, FAIR: 1, OVERVALUED: 2, UNKNOWN: 3 };
const BAND_PIE_COLORS: Record<string, string> = { UNDERVALUED: "#138A6B", FAIR: "#C49A46", OVERVALUED: "#C84B41", UNKNOWN: "#9BA6B5" };
const UNKNOWN_REASON_LABEL: Record<string, string> = {
  SNAPSHOT_MISSING: "시세 스냅샷 없음",
  PRICE_STALE: "시세 동기화 실패/지연",
  MISSING_EPS: "EPS 데이터 없음",
  MISSING_INDUSTRY_PER: "산업 PER 없음",
  MISSING_FUNDAMENTALS: "펀더멘탈 데이터 없음",
  INVALID_PRICE: "현재가 데이터 오류",
};

function formatUnknownReason(codes: string[]): string {
  const labels = [...new Set(codes.map((code) => UNKNOWN_REASON_LABEL[code] ?? code))];
  return labels.length > 0 ? labels.join(", ") : "원인 미확인";
}

function ValuationPage() {
  const { user } = useAuth();
  const [marketFilter, setMarketFilter] = useState("ALL");
  const [bandFilter, setBandFilter] = useState("ALL");
  const [scoreFilter, setScoreFilter] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["valuation", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // 시세 동기화 먼저 실행 (최신 EPS/PER 확보)
      await syncPrices().catch(() => {});
      const { data: assets } = await supabase.from("portfolio_assets").select("*").eq("status", "active");
      const tickers = (assets ?? []).map((a) => a.ticker);
      const { data: prices } = tickers.length
        ? await supabase.from("price_snapshots").select("*").in("ticker", tickers)
        : { data: [] as never[] };
      return { assets: assets ?? [], prices: prices ?? [] };
    },
  });

  if (isLoading || !data) return <div className="surface-card p-8 text-center text-muted-foreground animate-pulse">로딩 중...</div>;

  const rows = data.assets.map((a) => {
    const p = data.prices.find((pp) => pp.ticker === a.ticker && pp.market === a.market);
    const cur = p ? Number(p.current_price) : Number(a.avg_price);
    const v = p ? computeValuation({
      currentPrice: cur,
      eps: p.eps != null ? Number(p.eps) : null,
      per: p.per != null ? Number(p.per) : null,
      industryPer: p.industry_per != null ? Number(p.industry_per) : null,
    }) : null;
    const reasonCodes = Array.from(
      new Set([
        ...(v?.reasonCodes ?? (p ? ["MISSING_FUNDAMENTALS"] : ["SNAPSHOT_MISSING"])),
        ...(p?.is_stale ? ["PRICE_STALE"] : []),
      ]),
    );

    return {
      id: a.id, ticker: a.ticker, name: a.name, market: a.market, currency: a.currency,
      currentPrice: cur, fairValue: v?.fairValue ?? null, gapPercent: v?.gapPercent ?? null,
      score: v?.score ?? null, band: v?.band ?? "UNKNOWN" as const,
      reasonCodes, computedAt: new Date().toLocaleString("ko-KR"),
    };
  })
    .filter((r) => marketFilter === "ALL" || r.market === marketFilter)
    .filter((r) => bandFilter === "ALL" || r.band === bandFilter)
    .filter((r) => {
      if (scoreFilter === "ALL") return true;
      if (scoreFilter === "HIGH" && r.score != null && r.score >= 70) return true;
      if (scoreFilter === "MID" && r.score != null && r.score >= 40 && r.score < 70) return true;
      if (scoreFilter === "LOW" && r.score != null && r.score < 40) return true;
      return false;
    })
    .sort((a, b) => {
      const oa = BAND_ORDER[a.band as keyof typeof BAND_ORDER] ?? 3;
      const ob = BAND_ORDER[b.band as keyof typeof BAND_ORDER] ?? 3;
      if (oa !== ob) return oa - ob;
      return (b.score ?? -1) - (a.score ?? -1);
    });

  // fail rows (UNKNOWN) separated
  const normalRows = rows.filter((r) => r.band !== "UNKNOWN");
  const unknownRows = rows.filter((r) => r.band === "UNKNOWN");

  // KPIs
  const scores = rows.map((r) => r.score).filter((s): s is number => s != null);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const undervalued = rows.filter((r) => r.band === "UNDERVALUED").length;

  // 밴드 분포 도넛
  const bandDist = (["UNDERVALUED", "FAIR", "OVERVALUED", "UNKNOWN"] as const).map((b) => ({
    band: BAND_LABEL[b], value: rows.filter((r) => r.band === b).length, key: b,
  })).filter((d) => d.value > 0);

  // 점수 막대 차트
  const barData = rows.filter((r) => r.score != null).map((r) => ({
    ticker: r.ticker, score: r.score, band: r.band,
  }));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-bold">가치평가</h1>

      {/* ── KPI 3개 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface-card p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">평균 점수</div>
            <Award className="h-4 w-4 text-gold" />
          </div>
          <div className="mt-3 font-display text-2xl font-semibold num">{avgScore ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">100점 만점</div>
        </div>
        <div className="surface-card p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">저평가 자산</div>
            <TrendingDown className="h-4 w-4 text-success" />
          </div>
          <div className="mt-3 font-display text-2xl font-semibold text-success">{undervalued}개</div>
          <div className="text-xs text-muted-foreground mt-1">전체 {rows.length}개 중</div>
        </div>
        <div className="surface-card p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">룰 버전</div>
            <FileText className="h-4 w-4 text-gold" />
          </div>
          <div className="mt-3 font-display text-2xl font-semibold">v1</div>
          <div className="text-xs text-muted-foreground mt-1">ACTIVE</div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={marketFilter} onValueChange={setMarketFilter}>
          <SelectTrigger className="w-24 h-9"><SelectValue placeholder="시장" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체</SelectItem>
            <SelectItem value="US">US</SelectItem>
            <SelectItem value="KR">KR</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bandFilter} onValueChange={setBandFilter}>
          <SelectTrigger className="w-28 h-9"><SelectValue placeholder="밴드" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체</SelectItem>
            <SelectItem value="UNDERVALUED">저평가</SelectItem>
            <SelectItem value="FAIR">적정</SelectItem>
            <SelectItem value="OVERVALUED">고평가</SelectItem>
            <SelectItem value="UNKNOWN">미정</SelectItem>
          </SelectContent>
        </Select>
        <Select value={scoreFilter} onValueChange={setScoreFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="점수 구간" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체</SelectItem>
            <SelectItem value="HIGH">70점 이상</SelectItem>
            <SelectItem value="MID">40~69점</SelectItem>
            <SelectItem value="LOW">40점 미만</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Charts: 점수 막대 + 밴드 도넛 ── */}
      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 surface-card p-5">
          <div className="font-display font-semibold mb-4">자산별 점수</div>
          {barData.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12">평가 가능한 자산이 없습니다</div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer>
                <BarChart data={barData}>
                  <XAxis dataKey="ticker" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {barData.map((d, i) => <Cell key={i} fill={BAND_PIE_COLORS[d.band] ?? "#9BA6B5"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="lg:col-span-4 surface-card p-5">
          <div className="font-display font-semibold mb-4">밴드 분포</div>
          {bandDist.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12">데이터 없음</div>
          ) : (
            <div className="h-[240px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={bandDist} dataKey="value" nameKey="band" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {bandDist.map((d) => <Cell key={d.key} fill={BAND_PIE_COLORS[d.key]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {bandDist.map((d) => (
              <div key={d.key} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: BAND_PIE_COLORS[d.key] }} />
                {d.band} ({d.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 평가 테이블 ── */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="text-left text-xs text-muted-foreground bg-muted/30">
              <tr>
                <th className="py-3 px-4">종목명</th><th>현재가</th><th>적정가</th>
                <th className="text-right">괴리율</th><th className="text-right">점수</th>
                <th>밴드</th><th>계산 시각</th>
              </tr>
            </thead>
            <tbody>
              {normalRows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="py-3 px-4">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground num">{r.ticker} · {r.market}</div>
                  </td>
                  <td className="num">{formatCurrency(r.currentPrice, r.currency)}</td>
                  <td className="num">{r.fairValue ? formatCurrency(r.fairValue, r.currency) : "—"}</td>
                  <td className={`text-right num ${r.gapPercent != null ? pnlColor(r.gapPercent) : ""}`}>
                    {r.gapPercent != null ? formatPercent(r.gapPercent) : "—"}
                  </td>
                  <td className="text-right num font-medium">{r.score ?? "—"}</td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${BAND_COLOR[r.band as keyof typeof BAND_COLOR]}`}>
                      {BAND_LABEL[r.band as keyof typeof BAND_LABEL]}
                    </span>
                  </td>
                  <td className="text-xs text-muted-foreground num">{r.computedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── §13 UNKNOWN / 실패 자산 별도 섹션 ── */}
      {unknownRows.length > 0 && (
        <div className="surface-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <div className="font-display font-semibold">평가 불가 자산</div>
            <span className="text-xs text-muted-foreground">({unknownRows.length}건)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-2 px-4">종목</th><th>시장</th><th>현재가</th><th>사유</th></tr>
              </thead>
              <tbody>
                {unknownRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 px-4 font-medium">{r.name} <span className="num text-xs text-muted-foreground">({r.ticker})</span></td>
                    <td>{r.market}</td>
                    <td className="num">{formatCurrency(r.currentPrice, r.currency)}</td>
                    <td className="text-xs text-muted-foreground">{formatUnknownReason(r.reasonCodes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
