import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatPercent, pnlColor } from "@/lib/format";
import { computeValuation, BAND_LABEL, BAND_COLOR } from "@/lib/valuation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, ChevronLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

export const Route = createFileRoute("/_authenticated/portfolio/assets/$id")({ component: AssetDetail });

function AssetDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["asset", id],
    enabled: !!user,
    queryFn: async () => {
      const { data: asset } = await supabase.from("portfolio_assets").select("*").eq("id", id).single();
      const { data: price } = asset ? await supabase.from("price_snapshots").select("*").eq("ticker", asset.ticker).eq("market", asset.market).maybeSingle() : { data: null };
      const { data: valuations } = await supabase.from("valuation_results").select("*").eq("asset_id", id).order("computed_at", { ascending: false }).limit(5);
      return { asset, price, valuations: valuations ?? [] };
    },
  });

  // Soft delete – status = 'archived'
  const del = useMutation({
    mutationFn: async () => {
      await supabase.from("portfolio_assets").update({ status: "archived" }).eq("id", id);
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("삭제되었습니다"); navigate({ to: "/portfolio/assets" }); },
  });

  if (isLoading || !data?.asset) return <div className="text-muted-foreground p-8">로딩 중...</div>;
  const a = data.asset;
  const p = data.price;
  const cur = p ? Number(p.current_price) : Number(a.avg_price);
  const value = cur * Number(a.quantity);
  const cost = Number(a.avg_price) * Number(a.quantity);
  const pnl = value - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
  const v = p ? computeValuation({
    currentPrice: cur,
    eps: p.eps != null ? Number(p.eps) : null,
    per: p.per != null ? Number(p.per) : null,
    industryPer: p.industry_per != null ? Number(p.industry_per) : null,
  }) : null;

  // 30d trend mock
  const trend = Array.from({ length: 30 }).map((_, i) => {
    const noise = Math.sin(i / 3) * 0.02 + (Math.random() - 0.5) * 0.01;
    return { day: `D-${30 - i}`, price: cur * (1 - 0.05 + (i / 30) * 0.05 + noise) };
  });

  return (
    <div className="space-y-6">
      <Link to="/portfolio/assets" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> 목록
      </Link>

      {/* Summary card */}
      <div className="surface-card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="font-display text-2xl font-semibold">{a.name}</div>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${a.status === "active" ? "badge-success" : "badge-warning"}`}>
                {a.status === "active" ? "사용 중" : "보관됨"}
              </span>
            </div>
            <div className="text-sm text-muted-foreground num mt-1">{a.ticker} · {a.market}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-display font-semibold num">{formatCurrency(cur, a.currency)}</div>
            <div className="text-sm num font-medium">{formatCurrency(value, a.currency)}</div>
            <div className={`text-sm num ${pnlColor(pnlPct)}`}>{formatPercent(pnlPct)}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> 편집
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive border-destructive/30">
                <Trash2 className="h-4 w-4" /> 삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>자산 삭제</AlertDialogTitle>
                <AlertDialogDescription>
                  이 자산을 포트폴리오에서 제거합니다. 삭제 후에도 감사 로그는 유지됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={() => del.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  삭제
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Body: 2 column */}
      <div className="grid lg:grid-cols-12 gap-4">
        {/* Left: chart + holding */}
        <div className="lg:col-span-8 space-y-4">
          <div className="surface-card p-5">
            <div className="font-display font-semibold mb-4">가격 추이 (최근 30일)</div>
            <div className="h-[280px]">
              <ResponsiveContainer>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C49A46" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#C49A46" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
                  <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                  <Tooltip formatter={(val: number) => formatCurrency(val, a.currency)} />
                  <Area type="monotone" dataKey="price" stroke="#C49A46" strokeWidth={2} fill="url(#priceGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface-card p-5">
            <div className="font-display font-semibold mb-4">보유 정보</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Cell label="수량" value={String(Number(a.quantity))} />
              <Cell label="평균단가" value={formatCurrency(Number(a.avg_price), a.currency)} />
              <Cell label="통화" value={a.currency} />
              <Cell label="마지막 시세 반영" value={p?.last_synced_at ? new Date(p.last_synced_at).toLocaleString("ko-KR") : "—"} />
            </div>
          </div>
        </div>

        {/* Right: valuation + metadata */}
        <div className="lg:col-span-4 space-y-4">
          <div className="surface-card p-5">
            <div className="font-display font-semibold mb-4">가치평가 결과</div>
            {v ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className={`text-sm px-2.5 py-1 rounded-full border ${BAND_COLOR[v.band]}`}>{BAND_LABEL[v.band]}</span>
                  <span className="text-xs text-muted-foreground">룰 v1</span>
                </div>
                <Cell label="점수" value={v.score != null ? String(v.score) : "—"} />
                <Cell label="적정가" value={v.fairValue ? formatCurrency(v.fairValue, a.currency) : "—"} />
                <Cell label="괴리율" value={v.gapPercent != null ? formatPercent(v.gapPercent) : "—"} />
                <div>
                  <div className="text-xs text-muted-foreground mb-1">근거 코드 (최대 3개)</div>
                  <div className="flex flex-wrap gap-1">
                    {v.reasonCodes.slice(0, 3).map((c) => <span key={c} className="text-xs px-2 py-0.5 rounded bg-muted">{c}</span>)}
                  </div>
                </div>
              </div>
            ) : <div className="text-sm text-muted-foreground">평가 불가 (펀더멘탈 없음)</div>}
          </div>

          <div className="surface-card p-5">
            <div className="font-display font-semibold mb-4">메타데이터</div>
            <div className="space-y-3">
              <Cell label="등록일" value={new Date(a.created_at).toLocaleDateString("ko-KR")} />
              <Cell label="수정일" value={a.updated_at ? new Date(a.updated_at).toLocaleDateString("ko-KR") : "—"} />
              <Cell label="상태" value={a.status === "active" ? "활성" : "보관됨"} />
              <Cell label="손익" value={formatCurrency(pnl, a.currency)} valueClass={pnlColor(pnl)} />
              <Cell label="손익률" value={formatPercent(pnlPct)} valueClass={pnlColor(pnlPct)} />
            </div>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <EditAssetDialog asset={a} open={editOpen} onOpenChange={setEditOpen} onDone={() => { setEditOpen(false); qc.invalidateQueries(); }} />
    </div>
  );
}

function Cell({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 num font-medium ${valueClass}`}>{value}</div>
    </div>
  );
}

/* ── Edit Dialog ── */
function EditAssetDialog({ asset, open, onOpenChange, onDone }: {
  asset: { id: string; quantity: number | string; avg_price: number | string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [quantity, setQuantity] = useState(String(Number(asset.quantity)));
  const [avgPrice, setAvgPrice] = useState(String(Number(asset.avg_price)));

  const mut = useMutation({
    mutationFn: async () => {
      if (Number(quantity) <= 0) throw new Error("보유 수량은 0보다 커야 합니다.");
      if (Number(avgPrice) < 0) throw new Error("평균단가는 0 이상이어야 합니다.");
      await supabase.from("portfolio_assets").update({
        quantity: Number(quantity),
        avg_price: Number(avgPrice),
        updated_at: new Date().toISOString(),
      }).eq("id", asset.id);
    },
    onSuccess: () => { toast.success("수정되었습니다"); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "수정 실패"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>자산 편집</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label>수량 <span className="text-destructive">*</span></Label>
            <Input type="number" step="0.0001" min="0.0001" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="text-right" required />
          </div>
          <div className="space-y-1.5">
            <Label>평균단가 <span className="text-destructive">*</span></Label>
            <Input type="number" step="0.0001" min="0" value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)} className="text-right" required />
          </div>
          <Button type="submit" className="w-full" disabled={mut.isPending}>{mut.isPending ? "저장 중..." : "저장"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
