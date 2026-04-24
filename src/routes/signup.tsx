import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("비밀번호는 6자 이상이어야 합니다"); return; }
    setLoading(true);
    try {
      await signUp(email, password, name);
      toast.success("가입이 완료되었습니다");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "가입 실패");
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
          <h1 className="mt-4 font-display text-2xl font-semibold">회원가입</h1>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호 (6자 이상)</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "처리 중..." : "가입하기"}</Button>
        </form>
        <div className="mt-6 text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요? <Link to="/login" className="text-navy font-medium hover:underline">로그인</Link>
        </div>
      </div>
    </div>
  );
}
