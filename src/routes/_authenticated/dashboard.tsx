import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatPercent, pnlColor } from "@/lib/format";
import {
  convertCurrency,
  resolveDisplayCurrency,
  type CurrencyCode,
} from "@/lib/portfolio-currency";
import { computeValuation, BAND_LABEL, BAND_COLOR } from "@/lib/valuation";
import { syncPrices, getLastSyncTime } from "@/lib/stock-api";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  Wallet,
  TrendingUp,
  CalendarClock,
  Award,
  Plus,
  Download,
  Sparkles,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { openChatbot } from "@/lib/chatbot-launcher";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: DashboardPage });

const PIE_COLORS = ["#16233B", "#C49A46", "#5D7AA9", "#A07A3E", "#3B5476", "#D4B374"];

type PriceWithExchangeRate = {
  exchange_rate?: number | null;
};

function formatAxisCurrency(value: number, currency: CurrencyCode) {
  if (currency === "KRW") {
    return `${(value / 10000).toFixed(0)}만원`;
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 1,
  }).format(value);
}

function getExchangeRate(prices: PriceWithExchangeRate[]) {
  const rate = prices.find((price) => {
    const value = Number(price.exchange_rate);
    return Number.isFinite(value) && value > 0;
  })?.exchange_rate;

  return rate == null ? null : Number(rate);
}

function DashboardPage() {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: assets } = await supabase
        .from("portfolio_assets")
        .select("*")
        .eq("status", "active");

      const tickers = (assets ?? []).map((asset) => asset.ticker);
      const { data: prices } = tickers.length
        ? await supabase.from("price_snapshots").select("*").in("ticker", tickers)
        : { data: [] as never[] };

      const { data: valuations } = await supabase
        .from("valuation_results")
        .select("*")
        .order("computed_at", { ascending: false });

      const { data: portfolio } = await supabase
        .from("portfolios")
        .select("base_currency")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      return {
        assets: assets ?? [],
        prices: prices ?? [],
        valuations: valuations ?? [],
        portfolio,
      };
    },
  });

  useEffect(() => {
    if (!user || isLoading) return;

    const doSync = async () => {
      setSyncing(true);
      try {
        const count = await syncPrices();
        if (count > 0) {
          await refetch();
          toast.success(`${count}개 종목 가격을 동기화했습니다.`);
        }
        const syncTime = await getLastSyncTime();
        setLastSync(syncTime);
      } catch {
        // 자동 동기화 실패가 페이지 진입을 막으면 안 된다.
      } finally {
        setSyncing(false);
      }
    };

    void doSync();
  }, [user, isLoading, refetch]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const count = await syncPrices();
      await refetch();
      const syncTime = await getLastSyncTime();
      setLastSync(syncTime);
      toast.success(`${count}개 종목 가격을 동기화했습니다.`);
    } catch {
      toast.error("가격 동기화에 실패했습니다.");
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="surface-card h-[132px] animate-pulse bg-muted/30 p-5" />
          ))}
        </div>
      </div>
    );
  }

  const rows = data.assets.map((asset) => {
    const price = data.prices.find((item) => item.ticker === asset.ticker && item.market === asset.market);
    const currentPrice = price ? Number(price.current_price) : Number(asset.avg_price);
    const value = currentPrice * Number(asset.quantity);
    const cost = Number(asset.avg_price) * Number(asset.quantity);
    const pnl = value - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    const valuation = price
      ? computeValuation({
          currentPrice,
          eps: price.eps != null ? Number(price.eps) : null,
          per: price.per != null ? Number(price.per) : null,
          industryPer: price.industry_per != null ? Number(price.industry_per) : null,
        })
      : null;
    const dailyChg = price?.prev_close
      ? ((currentPrice - Number(price.prev_close)) / Number(price.prev_close)) * 100
      : 0;

    return {
      ...asset,
      currentPrice,
      value,
      cost,
      pnl,
      pnlPct,
      band: (valuation?.band ?? "UNKNOWN") as const,
      score: valuation?.score ?? null,
      dailyChg,
      updatedAt: asset.updated_at ?? asset.created_at,
    };
  });

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">포트폴리오 대시보드</h1>
        </div>
        <div className="surface-card space-y-4 p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
            <Sparkles className="h-8 w-8 text-gold" />
          </div>
          <div className="font-display text-lg font-semibold">아직 등록된 자산이 없습니다.</div>
          <div className="text-sm text-muted-foreground">
            AI 챗봇으로 종목과 수량을 입력하면 포트폴리오를 바로 생성할 수 있습니다.
          </div>
          <Button size="lg" className="mt-2" onClick={() => openChatbot({ prefill: "애플 주식 10주 보유 중이야" })}>
            <Sparkles className="h-4 w-4" /> AI로 자산 등록
          </Button>
        </div>
      </div>
    );
  }

  const displayCurrency = resolveDisplayCurrency(rows, data.portfolio?.base_currency);
  const exchangeRate = getExchangeRate(data.prices as PriceWithExchangeRate[]);
  const displayRows = rows.map((row) => ({
    ...row,
    displayValue: convertCurrency(row.value, row.currency, displayCurrency, exchangeRate),
    displayCost: convertCurrency(row.cost, row.currency, displayCurrency, exchangeRate),
  }));

  const total = displayRows.reduce((sum, row) => sum + row.displayValue, 0);
  const totalCost = displayRows.reduce((sum, row) => sum + row.displayCost, 0);
  const totalPnl = total - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const dailyValueChg = displayRows.reduce((sum, row) => sum + row.displayValue * (row.dailyChg / 100), 0);

  const scores = rows.map((row) => row.score).filter((score): score is number => score != null);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const pieData = displayRows.map((row) => ({ id: row.id, name: row.ticker, value: row.displayValue }));

  const trendData = Array.from({ length: 30 }).map((_, i) => {
    const factor = 1 - 0.08 + (i / 30) * 0.08 + Math.sin(i / 4) * 0.015;
    return { day: `D-${30 - i}`, value: Math.round(total * factor) };
  });

  const staleTickers = data.prices.filter((price) => price.is_stale).map((price) => price.ticker);

  const top5 = [...displayRows].sort((a, b) => b.displayValue - a.displayValue).slice(0, 5);
  const recent = [...rows]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">포트폴리오 대시보드</h1>
          {lastSync && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              마지막 가격 동기화: {new Date(lastSync).toLocaleString("ko-KR")}
            </div>
          )}
          <div className="mt-1 text-xs text-muted-foreground">
            표시 기준: {displayCurrency === "USD" ? "US / USD" : "KR / KRW"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleManualSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> 가격 동기화
          </Button>
          <Button asChild>
            <Link to="/portfolio/assets">
              <Plus className="h-4 w-4" /> 자산 추가
            </Link>
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4" /> 리포트 다운로드
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          icon={Wallet}
          label="총 자산 평가금액"
          value={formatCurrency(total, displayCurrency)}
          hint={`원금: ${formatCurrency(totalCost, displayCurrency)}`}
        />
        <KPI
          icon={TrendingUp}
          label="총 수익금"
          value={formatCurrency(totalPnl, displayCurrency)}
          hint={formatPercent(totalPnlPct)}
          valueClass={pnlColor(totalPnl)}
        />
        <KPI
          icon={CalendarClock}
          label="오늘 변동"
          value={formatCurrency(dailyValueChg, displayCurrency)}
          hint="전일 대비"
          valueClass={pnlColor(dailyValueChg)}
        />
        <KPI
          icon={Award}
          label="가치평가 평균 점수"
          value={avgScore != null ? String(avgScore) : "-"}
          hint={avgScore != null ? "100점 만점" : "평가 대기"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="surface-card p-5 lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-display font-semibold">포트폴리오 가치 추이</div>
            {staleTickers.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-amber-500">
                <AlertTriangle className="h-3 w-3" />
                {staleTickers.length}개 종목 가격이 지연되었습니다.
              </div>
            )}
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C49A46" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#C49A46" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatAxisCurrency(value, displayCurrency)} />
                <Tooltip formatter={(value: number) => formatCurrency(value, displayCurrency)} />
                <Area type="monotone" dataKey="value" stroke="#C49A46" strokeWidth={2} fill="url(#areaGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-5 lg:col-span-4">
          <div className="mb-4 font-display font-semibold">자산 비중</div>
          <div className="h-[280px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value, displayCurrency)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {pieData.map((item, i) => (
              <div key={item.id} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {item.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="surface-card p-5 lg:col-span-12">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-display font-semibold">평가금액 기준 Top 5</div>
            <Link to="/portfolio/assets" className="text-sm text-navy hover:underline">
              자산 전체보기
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">종목명</th>
                  <th className="text-right">수량</th>
                  <th className="text-right">현재가</th>
                  <th className="text-right">평가금액</th>
                  <th className="text-right">수익률</th>
                  <th>밸류에이션</th>
                </tr>
              </thead>
              <tbody>
                {top5.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-3">
                      <div className="font-medium">{row.name}</div>
                      <div className="num text-xs text-muted-foreground">
                        {row.ticker} · {row.market}
                      </div>
                    </td>
                    <td className="num text-right">{Number(row.quantity)}</td>
                    <td className="num text-right">{formatCurrency(row.currentPrice, row.currency)}</td>
                    <td className="num text-right font-medium">{formatCurrency(row.value, row.currency)}</td>
                    <td className={`num text-right ${pnlColor(row.pnlPct)}`}>{formatPercent(row.pnlPct)}</td>
                    <td>
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${BAND_COLOR[row.band]}`}>
                        {BAND_LABEL[row.band]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="surface-card p-5">
        <div className="mb-4 font-display font-semibold">최근 등록/수정 종목</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">종목명</th>
                <th>티커</th>
                <th>시장</th>
                <th className="text-right">수량</th>
                <th className="text-right">평균매수가</th>
                <th>수정일</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-medium">{row.name}</td>
                  <td className="num text-xs">{row.ticker}</td>
                  <td className="text-xs">{row.market}</td>
                  <td className="num text-right">{Number(row.quantity)}</td>
                  <td className="num text-right">{formatCurrency(Number(row.avg_price), row.currency)}</td>
                  <td className="num text-xs text-muted-foreground">
                    {new Date(row.updatedAt).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, hint, valueClass = "" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <div className="surface-card min-h-[132px] p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-gold" />
      </div>
      <div className={`num mt-3 font-display text-2xl font-semibold ${valueClass}`}>{value}</div>
      {hint && <div className="num mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
