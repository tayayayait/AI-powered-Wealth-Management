import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AdminShell } from "./AdminShell";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !isAdmin) navigate({ to: "/admin/login" });
  }, [isAuthenticated, isAdmin, loading, navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">로딩 중...</div>;
  if (!isAuthenticated || !isAdmin) return null;
  return <AdminShell>{children}</AdminShell>;
}
