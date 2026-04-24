import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatPercent, pnlColor } from "@/lib/format";
import { computeValuation, BAND_LABEL, BAND_COLOR } from "@/lib/valuation";
import { syncPrices, getLastSyncTime, ensureAndSync } from "@/lib/stock-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, Search, Sparkles, ArrowUpDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { openChatbot } from "@/lib/chatbot-launcher";
import { getOrCreatePortfolio } from "@/lib/portfolio";
import { mergeAssetPosition } from "@/lib/portfolio-assets";

export const Route = createFileRoute("/_authenticated/portfolio/assets")({ component: AssetsPage });

type SortKey = "value" | "pnlPct" | "ticker" | "updated_at";

function AssetsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [marketFilter, setMarketFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [bandFilter, setBandFilter] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["assets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: assets } = await supabase.from("portfolio_assets").select("*").order("created_at", { ascending: false });
      const { data: prices } = await supabase.from("price_snapshots").select("*");
      return { assets: assets ?? [], prices: prices ?? [] };
    },
  });

  // 페이지 진입 시 자동 시세 동기화
  useEffect(() => {
    if (!user || isLoading) return;
    const doSync = async () => {
      setSyncing(true);
      try {
        const count = await syncPrices();
        if (count > 0) {
          await refetch();
        }
        const syncTime = await getLastSyncTime();
        setLastSync(syncTime);
      } catch {
        // 무시
      } finally {
        setSyncing(false);
      }
    };
    doSync();
  }, [user, isLoading]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const count = await syncPrices();
      await refetch();
      const syncTime = await getLastSyncTime();
      setLastSync(syncTime);
      toast.success(`${count}개 종목 시세 갱신 완료`);
    } catch {
      toast.error("시세 갱신 실패");
    } finally {
      setSyncing(false);
    }
  };

  const rows = (data?.assets ?? []).map((a) => {
    const p = data?.prices.find((pp) => pp.ticker === a.ticker && pp.market === a.market);
    const cur = p ? Number(p.current_price) : Number(a.avg_price);
    const value = cur * Number(a.quantity);
    const cost = Number(a.avg_price) * Number(a.quantity);
    const pnlPct = cost > 0 ? ((value - cost) / cost) * 100 : 0;
    const v = p ? computeValuation({
      currentPrice: cur,
      eps: p.eps != null ? Number(p.eps) : null,
      per: p.per != null ? Number(p.per) : null,
      industryPer: p.industry_per != null ? Number(p.industry_per) : null,
    }) : null;
    const isStale = p?.is_stale ?? false;
    return { ...a, cur, value, cost, pnl: value - cost, pnlPct, band: v?.band ?? "UNKNOWN" as const, score: v?.score ?? null, isStale };
  })
    // text filter
    .filter((r) => !filter || r.ticker.toLowerCase().includes(filter.toLowerCase()) || r.name.toLowerCase().includes(filter.toLowerCase()))
    // market filter
    .filter((r) => marketFilter === "ALL" || r.market === marketFilter)
    // status filter
    .filter((r) => statusFilter === "ALL" || r.status === statusFilter)
    // band filter
    .filter((r) => bandFilter === "ALL" || r.band === bandFilter)
    // sort
    .sort((a, b) => {
      if (sortKey === "value") return b.value - a.value;
      if (sortKey === "pnlPct") return b.pnlPct - a.pnlPct;
      if (sortKey === "ticker") return a.ticker.localeCompare(b.ticker);
      return new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime();
    });

  const exportCsv = () => {
    const header = "종목명,티커,시장,수량,평단가,현재가,평가금액,수익률,밴드,상태,수정일\n";
    const body = rows.map((r) => [r.name, r.ticker, r.market, r.quantity, r.avg_price, r.cur, r.value.toFixed(0), r.pnlPct.toFixed(2), r.band, r.status, r.updated_at ?? r.created_at].join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "assets.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top area */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">보유 자산</h1>
          {lastSync && (
            <div className="text-xs text-muted-foreground mt-0.5">
              마지막 시세 갱신: {new Date(lastSync).toLocaleString("ko-KR")}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleManualSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> 시세 갱신
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openChatbot({ prefill: "애플 주식 10주 보유" })}
          >
            <Sparkles className="h-4 w-4" /> AI로 등록
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> 수동 등록</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>자산 추가</DialogTitle></DialogHeader>
              <AddAssetForm onDone={() => { setOpen(false); qc.invalidateQueries(); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search & filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 max-w-[280px] flex-1">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input placeholder="티커/종목명 검색" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9" />
        </div>
        <Select value={marketFilter} onValueChange={setMarketFilter}>
          <SelectTrigger className="w-24 h-9"><SelectValue placeholder="시장" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체</SelectItem>
            <SelectItem value="US">US</SelectItem>
            <SelectItem value="KR">KR</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-24 h-9"><SelectValue placeholder="상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체</SelectItem>
            <SelectItem value="active">활성</SelectItem>
            <SelectItem value="archived">보관</SelectItem>
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
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-36 h-9"><ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="value">평가금액 높은순</SelectItem>
            <SelectItem value="pnlPct">수익률 높은순</SelectItem>
            <SelectItem value="ticker">티커 오름차순</SelectItem>
            <SelectItem value="updated_at">최신 수정순</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>
      </div>

      {/* Table */}
      <div className="surface-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">로딩 중...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-muted-foreground">조건에 맞는 자산이 없습니다</div>
            <Button className="mt-4" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> 첫 자산 추가</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead className="text-left text-xs text-muted-foreground bg-muted/30 sticky top-0">
                <tr>
                  <th className="py-3 px-4">종목명</th>
                  <th>티커</th>
                  <th>시장</th>
                  <th className="text-right">보유수량</th>
                  <th className="text-right">평균단가</th>
                  <th className="text-right">현재가</th>
                  <th className="text-right">평가금액</th>
                  <th className="text-right">수익률</th>
                  <th>가치평가</th>
                  <th>상태</th>
                  <th>수정일</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => {}}>
                    <td className="py-3 px-4 font-medium">{r.name}</td>
                    <td className="num text-xs">
                      {r.ticker}
                      {r.isStale && <span className="ml-1 text-amber-500" title="시세 지연">⚠</span>}
                    </td>
                    <td className="text-xs">{r.market}</td>
                    <td className="text-right num">{Number(r.quantity)}</td>
                    <td className="text-right num">{formatCurrency(Number(r.avg_price), r.currency)}</td>
                    <td className="text-right num">{formatCurrency(r.cur, r.currency)}</td>
                    <td className="text-right num font-medium">{formatCurrency(r.value, r.currency)}</td>
                    <td className={`text-right num ${pnlColor(r.pnlPct)}`}>{formatPercent(r.pnlPct)}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${BAND_COLOR[r.band as keyof typeof BAND_COLOR]}`}>
                        {BAND_LABEL[r.band as keyof typeof BAND_LABEL]}
                      </span>
                    </td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${r.status === "active" ? "badge-success" : "badge-warning"}`}>
                        {r.status === "active" ? "사용 중" : "보관"}
                      </span>
                    </td>
                    <td className="text-xs text-muted-foreground num">{new Date(r.updated_at ?? r.created_at).toLocaleDateString("ko-KR")}</td>
                    <td className="text-right pr-4">
                      <Link to="/portfolio/assets/$id" params={{ id: r.id }} className="text-xs text-navy hover:underline" onClick={(e) => e.stopPropagation()}>상세</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AddAssetForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [ticker, setTicker] = useState("");
  const [market, setMarket] = useState<"US" | "KR">("US");
  const [quantity, setQuantity] = useState("");
  const [avgPrice, setAvgPrice] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not logged in");
      if (Number(quantity) <= 0) throw new Error("보유 수량은 0보다 커야 합니다.");
      if (Number(avgPrice) < 0) throw new Error("평균단가는 0 이상이어야 합니다.");
      const portfolio = await getOrCreatePortfolio(user.id);
      const normalizedTicker = ticker.toUpperCase();

      // ★ Yahoo Finance 시세 연동
      await ensureAndSync(normalizedTicker, market, normalizedTicker);

      const { data: priceRow } = await supabase
        .from("price_snapshots")
        .select("*")
        .eq("ticker", normalizedTicker)
        .eq("market", market)
        .maybeSingle();

      const insertPayload = priceRow
        ? {
            portfolio_id: portfolio.id,
            user_id: user.id,
            ticker: priceRow.ticker,
            market: priceRow.market,
            name: priceRow.name,
            quantity: Number(quantity),
            avg_price: Number(avgPrice),
            currency: priceRow.currency,
          }
        : {
            portfolio_id: portfolio.id,
            user_id: user.id,
            ticker: normalizedTicker,
            market,
            name: normalizedTicker,
            quantity: Number(quantity),
            avg_price: Number(avgPrice),
            currency: market === "KR" ? "KRW" : "USD",
          };

      const { data: existingAssets } = await supabase
        .from("portfolio_assets")
        .select("*")
        .eq("portfolio_id", portfolio.id)
        .ilike("ticker", insertPayload.ticker)
        .eq("market", insertPayload.market)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1);

      const existingAsset = existingAssets?.[0];
      const { data: savedAsset, error } = existingAsset
        ? await supabase
            .from("portfolio_assets")
            .update({
              ...mergeAssetPosition(existingAsset, insertPayload),
              ticker: insertPayload.ticker,
              name: insertPayload.name,
              currency: insertPayload.currency,
            })
            .eq("id", existingAsset.id)
            .select()
            .single()
        : await supabase
            .from("portfolio_assets")
            .insert(insertPayload)
            .select()
            .single();
      if (error || !savedAsset) throw error ?? new Error("asset save failed");

      const currentPriceForValuation = priceRow ? Number(priceRow.current_price) : Number(avgPrice);
      const v = computeValuation({
        currentPrice: currentPriceForValuation,
        eps: priceRow?.eps != null ? Number(priceRow.eps) : null,
        per: priceRow?.per != null ? Number(priceRow.per) : null,
        industryPer: priceRow?.industry_per != null ? Number(priceRow.industry_per) : null,
      });
      await supabase.from("valuation_results").insert({
        asset_id: savedAsset.id, user_id: user.id, rule_version: "v1",
        fair_value: v.fairValue, current_price: currentPriceForValuation,
        gap_percent: v.gapPercent, score: v.score, band: v.band, reason_codes: v.reasonCodes,
      });
    },
    onSuccess: () => { toast.success("추가했습니다. 시세가 곧 갱신됩니다."); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "추가 실패"),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>티커 <span className="text-destructive">*</span></Label><Input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="AAPL" required /></div>
        <div className="space-y-1.5">
          <Label>시장 <span className="text-destructive">*</span></Label>
          <Select value={market} onValueChange={(v) => setMarket(v as "US" | "KR")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="US">US</SelectItem><SelectItem value="KR">KR</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>수량 <span className="text-destructive">*</span></Label><Input type="number" step="0.0001" min="0.0001" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="text-right" required /></div>
        <div className="space-y-1.5"><Label>평단가</Label><Input type="number" step="0.0001" min="0" value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)} className="text-right" required /></div>
      </div>
      <Button type="submit" className="w-full" disabled={mut.isPending}>{mut.isPending ? "추가 중..." : "추가"}</Button>
    </form>
  );
}
