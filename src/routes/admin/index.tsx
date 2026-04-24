import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminGuard } from "@/components/AdminGuard";
import { Users, UserCheck, MessageSquare, AlertTriangle, Activity, Database, Cloud, Cpu } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/admin/")({ component: AdminHome });

function AdminHome() {
  return <AdminGuard><AdminHomeInner /></AdminGuard>;
}

function AdminHomeInner() {
  const { data } = useQuery({
    queryKey: ["admin-kpi"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [users, activeUsers, chats, confirmedChats, stale] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("chat_intents").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("chat_intents").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()).eq("status", "confirmed"),
        supabase.from("price_snapshots").select("id", { count: "exact", head: true }).eq("is_stale", true),
      ]);
      const chatTotal = chats.count ?? 0;
      const chatOk = confirmedChats.count ?? 0;
      const successRate = chatTotal > 0 ? Math.round((chatOk / chatTotal) * 100) : 0;
      return {
        totalUsers: users.count ?? 0,
        activeUsers: activeUsers.count ?? 0,
        chatSuccessRate: successRate,
        chatTotal,
        stale: stale.count ?? 0,
      };
    },
  });

  // Mock: 일별 가입/활성 추이 (최근 14일)
  const trendData = Array.from({ length: 14 }).map((_, i) => ({
    day: `D-${14 - i}`,
    signups: Math.floor(Math.random() * 5) + 1,
    active: Math.floor(Math.random() * 20) + 10,
  }));

  return (
    <div className="space-y-6">
      {/* KPI 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={Users} label="총 회원수" value={String(data?.totalUsers ?? 0)} />
        <KPI icon={UserCheck} label="활성 회원 수" value={String(data?.activeUsers ?? 0)} />
        <KPI icon={MessageSquare} label="오늘 챗봇 파싱 성공률" value={`${data?.chatSuccessRate ?? 0}%`} hint={`전체 ${data?.chatTotal ?? 0}건`} />
        <KPI icon={AlertTriangle} label="외부 데이터 장애" value={String(data?.stale ?? 0)} hint="stale 종목 수" />
      </div>

      {/* 일별 추이 차트 */}
      <div className="surface-card p-5">
        <div className="font-display font-semibold mb-4">일별 가입/활성 추이 (최근 14일)</div>
        <div className="h-[280px]">
          <ResponsiveContainer>
            <AreaChart data={trendData}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="signups" stackId="1" stroke="#C49A46" fill="#C49A46" fillOpacity={0.3} name="가입" />
              <Area type="monotone" dataKey="active" stackId="2" stroke="#16233B" fill="#16233B" fillOpacity={0.15} name="활성" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 시스템 상태 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard icon={Cloud} label="Gemini API" status="정상" ok />
        <StatusCard icon={Activity} label="Yahoo Finance" status={(data?.stale ?? 0) > 0 ? `${data?.stale}건 지연` : "정상"} ok={(data?.stale ?? 0) === 0} />
        <StatusCard icon={Cpu} label="가치평가 큐" status="대기 0건" ok />
        <StatusCard icon={Database} label="Supabase DB" status="정상" ok />
      </div>

      <div className="surface-card p-6 text-sm text-muted-foreground">
        좌측 메뉴에서 회원/데이터 운영 작업을 수행할 수 있습니다.
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string }) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-gold" />
      </div>
      <div className="mt-3 font-display text-2xl font-semibold num">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function StatusCard({ icon: Icon, label, status, ok }: { icon: React.ComponentType<{ className?: string }>; label: string; status: string; ok: boolean }) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div className="text-xs font-medium">{label}</div>
      </div>
      <div className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${ok ? "text-success" : "text-warning"}`}>
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-success" : "bg-warning animate-pulse"}`} />
        {status}
      </div>
    </div>
  );
}
