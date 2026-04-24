import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  getDemoAutoLoginCredentials,
  shouldRunDemoAutoLogin,
} from "@/lib/demo-auto-login";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { signIn, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const autoLoginAttempted = useRef(false);
  const busy = loading || authLoading;

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/dashboard" });
      return;
    }

    const pathname = typeof window === "undefined" ? "/login" : window.location.pathname;
    const search = typeof window === "undefined" ? "" : window.location.search;
    if (
      !shouldRunDemoAutoLogin({
        pathname,
        search,
        authLoading,
        isAuthenticated,
        autoLoginAttempted: autoLoginAttempted.current,
      })
    ) {
      return;
    }

    autoLoginAttempted.current = true;
    let cancelled = false;
    const credentials = getDemoAutoLoginCredentials();

    setLoading(true);
    void signIn(credentials.email, credentials.password)
      .then(() => {
        if (cancelled) return;
        toast.success("자동 로그인되었습니다");
        navigate({ to: "/dashboard" });
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "자동 로그인 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, navigate, signIn]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success("로그인되었습니다");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "로그인 실패");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md surface-card p-8">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-navy text-primary-foreground flex items-center justify-center font-display font-bold">W</div>
            <span className="font-display font-semibold">Wealth Console</span>
          </Link>
          <h1 className="mt-4 font-display text-2xl font-semibold">로그인</h1>
          <p className="text-sm text-muted-foreground mt-1">이메일로 로그인하세요</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "로그인 중..." : "로그인"}</Button>
        </form>
        <div className="mt-6 text-center text-sm text-muted-foreground">
          계정이 없으신가요? <Link to="/signup" className="text-navy font-medium underline-offset-2 hover:underline">회원가입</Link>
        </div>
      </div>
    </div>
  );
}
