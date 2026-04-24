import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminGuard } from "@/components/AdminGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/users")({ component: () => <AdminGuard><UsersPage /></AdminGuard> });

function UsersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [suspendTarget, setSuspendTarget] = useState<{ id: string; email: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: "active" | "suspended"; reason?: string }) => {
      await supabase.from("profiles").update({ status }).eq("id", id);
      if (user) await supabase.from("admin_audit_logs").insert({
        admin_id: user.id, action: `set_status:${status}`, target_type: "user", target_id: id,
        payload: reason ? { reason } : undefined,
      });
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("변경되었습니다"); setSuspendTarget(null); setSuspendReason(""); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "실패"),
  });

  const rows = (data ?? [])
    .filter((u) => !search || u.email.toLowerCase().includes(search.toLowerCase()) || (u.display_name ?? "").toLowerCase().includes(search.toLowerCase()))
    .filter((u) => statusFilter === "ALL" || u.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-lg">회원 관리</h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 max-w-[280px] flex-1">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input placeholder="이메일/이름 검색" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28 h-9"><SelectValue placeholder="상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체</SelectItem>
            <SelectItem value="active">활성</SelectItem>
            <SelectItem value="suspended">정지</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="text-left text-xs text-muted-foreground bg-muted/30">
              <tr>
                <th className="py-3 px-4">이메일</th><th>이름</th><th>상태</th>
                <th>가입일</th><th>최근 로그인</th>
                <th className="text-right pr-4">작업</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t hover:bg-muted/20">
                  <td className="py-3 px-4">{u.email}</td>
                  <td>{u.display_name ?? "—"}</td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${u.status === "active" ? "badge-success" : "badge-error"}`}>
                      {u.status === "active" ? "활성" : "정지"}
                    </span>
                  </td>
                  <td className="text-xs text-muted-foreground num">{new Date(u.created_at).toLocaleDateString("ko-KR")}</td>
                  <td className="text-xs text-muted-foreground num">{(u as Record<string, unknown>).last_sign_in_at ? new Date(String((u as Record<string, unknown>).last_sign_in_at)).toLocaleDateString("ko-KR") : "—"}</td>
                  <td className="text-right pr-4">
                    {u.status === "active" ? (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => setSuspendTarget({ id: u.id, email: u.email })}>정지</Button>
                    ) : (
                      <Button size="sm" onClick={() => setStatus.mutate({ id: u.id, status: "active" })}>활성화</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 정지 이유 입력 모달 */}
      <Dialog open={!!suspendTarget} onOpenChange={(open) => { if (!open) { setSuspendTarget(null); setSuspendReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>회원 정지</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm">{suspendTarget?.email}을(를) 정지합니다.</div>
            <div className="space-y-1.5">
              <Label>정지 이유 <span className="text-destructive">*</span></Label>
              <Input value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="정지 이유를 입력하세요" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSuspendTarget(null)}>취소</Button>
              <Button variant="destructive" disabled={!suspendReason.trim()} onClick={() => suspendTarget && setStatus.mutate({ id: suspendTarget.id, status: "suspended", reason: suspendReason })}>
                정지
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
