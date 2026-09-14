import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import type { Me } from "@/lib/auth";

const linkClass = "rounded px-3 py-1.5 text-header-foreground/80 hover:bg-white/10 hover:text-header-foreground";
const activeClass = { className: "rounded px-3 py-1.5 bg-white/15 text-header-foreground font-medium" };

export function AppHeader({ me }: { me?: Me }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function handleSignOut() {
    await signOut();
    qc.clear();
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="bg-header text-header-foreground">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-6 px-6">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight">사안 검토 시스템</span>
        </Link>
        {me && (
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/" className={linkClass} activeProps={activeClass} activeOptions={{ exact: true }}>
              새 사안 검토
            </Link>
            <Link to="/history" className={linkClass} activeProps={activeClass}>
              검토 이력
            </Link>
          </nav>
        )}
        {me && (
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-header-foreground/80">{me.user.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-header-foreground hover:bg-white/10 hover:text-header-foreground"
            >
              로그아웃
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
