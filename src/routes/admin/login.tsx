import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/login")({ component: AdminLoginPage });

function AdminLoginPage() {
  const { signIn, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      // verify admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인 실패");
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      await refreshRoles();
      if (!isAdmin) {
        await supabase.auth.signOut();
        toast.error("관리자 권한이 없습니다");
        return;
      }
      toast.success("관리자 로그인");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "로그인 실패");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-navy">
      <div className="w-full max-w-md surface-card p-8">
        <div className="text-center mb-6">
          <ShieldCheck className="h-10 w-10 mx-auto text-gold" />
          <h1 className="mt-3 font-display text-2xl font-semibold">관리자 로그인</h1>
          <p className="text-sm text-muted-foreground mt-1">Admin Console</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label>이메일</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-2"><Label>비밀번호</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "확인 중..." : "로그인"}</Button>
        </form>
        <div className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">← 메인으로</Link>
        </div>
      </div>
    </div>
  );
}
