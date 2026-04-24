import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminGuard } from "@/components/AdminGuard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/data")({ component: () => <AdminGuard><DataOpsPage /></AdminGuard> });

const STATUS_LABEL: Record<string, { label: string; class: string }> = {
  ACTIVE: { label: "ACTIVE", class: "badge-success" },
  DRAFT: { label: "DRAFT", class: "badge-info" },
  DEPRECATED: { label: "DEPRECATED", class: "badge-warning" },
};

function DataOpsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: prices } = useQuery({
    queryKey: ["admin-prices"],
    queryFn: async () => {
      const { data } = await supabase.from("price_snapshots").select("*").order("ticker");
      return data ?? [];
    },
  });

  const { data: rules } = useQuery({
    queryKey: ["admin-rules"],
    queryFn: async () => {
      const { data } = await supabase.from("valuation_rule_versions").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["admin-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  // 동기화 상태 계산
  const staleCount = prices?.filter((p) => p.is_stale).length ?? 0;
  const lastSync = prices?.length ? new Date(Math.max(...prices.map((p) => new Date(p.last_synced_at).getTime()))) : null;

  const sync = useMutation({
    mutationFn: async () => {
      const { data: rows } = await supabase.from("price_snapshots").select("*");
      if (!rows) return;
      const now = new Date().toISOString();
      for (const r of rows) {
        const cur = Number(r.current_price);
        const noise = (Math.random() - 0.5) * 0.04;
        const next = Math.max(0.01, cur * (1 + noise));
        await supabase.from("price_snapshots").update({
          prev_close: cur, current_price: Number(next.toFixed(4)),
          last_synced_at: now, is_stale: false,
        }).eq("id", r.id);
      }
      if (user) await supabase.from("admin_audit_logs").insert({
        admin_id: user.id, action: "sync_prices", target_type: "price_snapshots", payload: { count: rows.length },
      });
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("시세 동기화 완료"); },
    onError: () => toast.error("동기화 실패"),
  });

  const activate = useMutation({
    mutationFn: async (version: string) => {
      await supabase.from("valuation_rule_versions").update({ is_active: false }).neq("version", "__none__");
      await supabase.from("valuation_rule_versions").update({ is_active: true }).eq("version", version);
      if (user) await supabase.from("admin_audit_logs").insert({
        admin_id: user.id, action: "activate_rule", target_type: "valuation_rule_version", target_id: version,
      });
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("활성화"); },
  });

  return (
    <div className="space-y-6">
      {/* §13 시세 동기화 상태 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface-card p-4">
          <div className="text-xs text-muted-foreground">마지막 성공 시각</div>
          <div className="mt-1 num font-medium text-sm">{lastSync ? lastSync.toLocaleString("ko-KR") : "—"}</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-xs text-muted-foreground">실패/stale 건수</div>
          <div className={`mt-1 num font-medium text-sm ${staleCount > 0 ? "text-warning" : "text-success"}`}>{staleCount}건</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-xs text-muted-foreground">총 종목 수</div>
          <div className="mt-1 num font-medium text-sm">{prices?.length ?? 0}개</div>
        </div>
      </div>

      {/* 시세 스냅샷 */}
      <div className="surface-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="font-display font-semibold">시세 스냅샷</div>
          <Button onClick={() => sync.mutate()} disabled={sync.isPending} size="sm">
            <RefreshCw className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} /> 수동 동기화
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr>
                <th className="py-2">티커</th><th>종목명</th>
                <th className="text-right">현재가</th><th className="text-right">전일</th>
                <th>상태</th><th>마지막 동기화</th>
              </tr>
            </thead>
            <tbody>
              {(prices ?? []).map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="py-2 num">{p.ticker} <span className="text-xs text-muted-foreground">{p.market}</span></td>
                  <td>{p.name}</td>
                  <td className="text-right num">{formatCurrency(Number(p.current_price), p.currency)}</td>
                  <td className="text-right num text-muted-foreground">{p.prev_close ? formatCurrency(Number(p.prev_close), p.currency) : "—"}</td>
                  <td>{p.is_stale ? <span className="badge-warning text-xs px-2 py-0.5 rounded-full">stale</span> : <span className="badge-success text-xs px-2 py-0.5 rounded-full">정상</span>}</td>
                  <td className="text-xs text-muted-foreground num">{new Date(p.last_synced_at).toLocaleString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 가치평가 룰 버전 */}
      <div className="surface-card p-5">
        <div className="font-display font-semibold mb-4">가치평가 룰 버전</div>
        <div className="space-y-2">
          {(rules ?? []).map((r) => {
            const ruleStatus = r.is_active ? "ACTIVE" : "DRAFT";
            const st = STATUS_LABEL[ruleStatus] ?? STATUS_LABEL.DRAFT;
            return (
              <div key={r.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium num">{r.version}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${st.class}`}>{st.label}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>
                </div>
                {!r.is_active && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">활성화</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>룰 활성화 확인</AlertDialogTitle>
                        <AlertDialogDescription>
                          "{r.version}" 룰을 활성 상태로 전환합니다. 기존 활성 룰은 비활성화됩니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={() => activate.mutate(r.version)}>활성화</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* §13 시스템 작업 로그 최근 20건 */}
      <div className="surface-card p-5">
        <div className="font-display font-semibold mb-4">시스템 작업 로그 (최근 20건)</div>
        {(logs ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">로그가 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b">
                <tr><th className="py-2">시각</th><th>작업</th><th>대상</th><th>ID</th></tr>
              </thead>
              <tbody>
                {(logs ?? []).map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2 text-xs num text-muted-foreground">{new Date(l.created_at).toLocaleString("ko-KR")}</td>
                    <td className="font-medium">{l.action}</td>
                    <td className="text-xs">{l.target_type}</td>
                    <td className="text-xs text-muted-foreground num">{l.target_id ?? "—"}</td>
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
