import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/access";

const linkClass = "rounded px-3 py-1.5 text-header-foreground/80 hover:bg-white/10 hover:text-header-foreground";
const activeClass = { className: "rounded px-3 py-1.5 bg-white/15 text-header-foreground font-medium" };

export function AppHeader({ role, onSignOut }: { role?: Role; onSignOut?: () => void }) {
  return (
    <header className="bg-header text-header-foreground">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-6 px-6">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight">민형사 검토 시스템</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/" className={linkClass} activeProps={activeClass} activeOptions={{ exact: true }}>
            신규 검토
          </Link>
          {role === "admin" && (
            <Link to="/history" className={linkClass} activeProps={activeClass}>
              검토 이력
            </Link>
          )}
        </nav>
        {onSignOut && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            className="ml-auto text-header-foreground hover:bg-white/10 hover:text-header-foreground"
          >
            인증화면
          </Button>
        )}
      </div>
    </header>
  );
}
