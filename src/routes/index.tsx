import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Sparkles, BarChart3, MessageSquare, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Wealth Console — AI 챗봇 자산관리" },
      { name: "description", content: "AI 챗봇 한 줄로 자산을 등록하고 가치평가까지 받아보는 개인 자산관리 콘솔" },
    ],
  }),
});

function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: "/dashboard" });
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-navy text-primary-foreground flex items-center justify-center font-display font-bold">W</div>
          <span className="font-display font-semibold">Wealth Console</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link to="/login">로그인</Link></Button>
          <Button asChild><Link to="/signup">시작하기</Link></Button>
        </div>
      </header>

      <section className="px-6 md:px-10 pt-12 md:pt-24 pb-16 max-w-6xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/40 bg-gold/10 text-gold text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5" /> Lovable AI 기반 자연어 자산 관리
        </div>
        <h1 className="mt-6 font-display text-4xl md:text-6xl font-bold tracking-tight leading-tight">
          말 한 줄로 등록하는<br />당신의 <span className="text-gold">프라이빗 자산 콘솔</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
          "테슬라 10주 250달러에 추가" 처럼 자연어로 입력하면 AI가 자산을 정리하고,
          룰 기반 가치평가로 적정/저평가/고평가 밴드를 즉시 보여드립니다.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg"><Link to="/signup">무료로 시작하기</Link></Button>
          <Button asChild variant="outline" size="lg"><Link to="/login">로그인</Link></Button>
        </div>
      </section>

      <section className="px-6 md:px-10 pb-24 max-w-6xl mx-auto grid md:grid-cols-3 gap-4">
        {[
          { icon: MessageSquare, title: "자연어 챗봇", desc: "추가/수정/삭제/조회까지 모든 자산 작업을 대화로 처리합니다." },
          { icon: BarChart3, title: "가치평가 엔진", desc: "PER 기반 룰로 적정가와 갭%를 한눈에. 밴드별 시각화 제공." },
          { icon: ShieldCheck, title: "안전한 권한 분리", desc: "RLS 기반 본인 데이터 보호, 관리자 콘솔 분리 운영." },
        ].map((f) => (
          <div key={f.title} className="surface-card p-6">
            <div className="h-10 w-10 rounded-md bg-accent flex items-center justify-center mb-4">
              <f.icon className="h-5 w-5 text-navy" />
            </div>
            <div className="font-display font-semibold mb-1">{f.title}</div>
            <div className="text-sm text-muted-foreground">{f.desc}</div>
          </div>
        ))}
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Wealth Console · Powered by Lovable Cloud & AI
      </footer>
    </div>
  );
}
