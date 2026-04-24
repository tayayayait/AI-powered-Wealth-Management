import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutDashboard, Briefcase, BarChart3, User, LogOut, Sparkles, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { to: "/portfolio/assets", label: "보유 자산", icon: Briefcase },
  { to: "/portfolio/valuation", label: "가치평가", icon: BarChart3 },
  { to: "/mypage", label: "마이페이지", icon: User },
] as const;

export function MemberShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-[264px] flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0">
        <SidebarContent pathname={location.pathname} />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-[264px] h-full bg-sidebar text-sidebar-foreground flex flex-col shadow-2xl">
            <div className="absolute top-4 right-4">
              <button onClick={() => setMobileOpen(false)} className="text-sidebar-foreground/70 hover:text-sidebar-foreground" aria-label="닫기"><X className="h-5 w-5" /></button>
            </div>
            <SidebarContent pathname={location.pathname} onNav={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[72px] border-b bg-card/60 backdrop-blur px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button onClick={() => setMobileOpen(true)} className="md:hidden" aria-label="메뉴 열기">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <div className="text-xs text-muted-foreground">Executive Wealth Console</div>
              <div className="font-display font-semibold text-lg">{getTitle(location.pathname)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right text-sm">
              <div className="font-medium">{user?.email}</div>
              <div className="text-xs text-muted-foreground">회원</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">로그아웃</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

/* Shared sidebar content for desktop & mobile */
function SidebarContent({ pathname, onNav }: { pathname: string; onNav?: () => void }) {
  return (
    <>
      <div className="h-[72px] px-6 flex items-center gap-2 border-b border-sidebar-border">
        <div className="h-8 w-8 rounded-md bg-gold flex items-center justify-center text-gold-foreground font-display font-bold">W</div>
        <div>
          <div className="font-display font-semibold text-sidebar-foreground leading-none">Wealth Console</div>
          <div className="text-[11px] text-sidebar-foreground/60 mt-0.5">AI 자산관리</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNav}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-gold"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-sidebar-foreground/60">
          <Sparkles className="h-3.5 w-3.5 text-gold" />
          AI 챗봇으로 자산을 등록해보세요
        </div>
      </div>
    </>
  );
}

function getTitle(path: string) {
  if (path.startsWith("/dashboard")) return "대시보드";
  if (path.startsWith("/portfolio/assets")) return "보유 자산";
  if (path.startsWith("/portfolio/valuation")) return "가치평가";
  if (path.startsWith("/mypage")) return "마이페이지";
  return "";
}
