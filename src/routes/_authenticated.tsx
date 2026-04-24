import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { MemberShell } from "@/components/MemberShell";
import { ChatbotPanel } from "@/components/ChatbotPanel";

export const Route = createFileRoute("/_authenticated")({ component: ProtectedLayout });

function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate({ to: "/login" });
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">로딩 중...</div>;
  }
  if (!isAuthenticated) return null;

  return (
    <MemberShell>
      <Outlet />
      <ChatbotPanel />
    </MemberShell>
  );
}
