import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, Database, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV: Array<{ to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
  { to: "/admin", label: "개요", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "회원 관리", icon: Users },
  { to: "/admin/data", label: "데이터 운영", icon: Database },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-[248px] flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="h-[64px] px-5 flex items-center gap-2 border-b border-sidebar-border">
          <ShieldCheck className="h-5 w-5 text-gold" />
          <div>
            <div className="font-display font-semibold leading-none">Admin</div>
            <div className="text-[11px] text-sidebar-foreground/60 mt-0.5">Operations</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to as "/admin"}
                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50")}>
                <Icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[64px] border-b bg-card/60 backdrop-blur px-6 flex items-center justify-between">
          <div className="font-display font-semibold">관리자 콘솔</div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">{user?.email}</div>
            <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/admin/login" }); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
