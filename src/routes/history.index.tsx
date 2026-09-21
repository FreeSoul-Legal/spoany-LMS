import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteLegalReview, errorMessage, fetchLegalReviews, fmtDateTime, updateLegalReviewTitle } from "@/lib/legal-review";
import { AppHeader } from "@/components/AppHeader";
import { PasscodeScreen } from "@/components/PasscodeScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePasscodeGate } from "@/lib/access";

export const Route = createFileRoute("/history/")({
  head: () => ({
    meta: [
      { title: "검토 이력 · 법률 상담 시스템" },
      { name: "description", content: "지금까지 분석한 사안과 작성한 보고서·서면을 다시 확인합니다." },
    ],
  }),
  component: HistoryListPage,
});

function HistoryListPage() {
  const qc = useQueryClient();
  const { role, ready, setRole, signOut } = usePasscodeGate();
  const { data: reviews, isLoading } = useQuery({
    queryKey: ["legal-reviews"],
    queryFn: fetchLegalReviews,
    enabled: role === "admin",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpenId) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenId]);

  function startEdit(id: string, currentTitle: string) {
    setEditingId(id);
    setEditValue(currentTitle);
    setMenuOpenId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  async function saveEdit(id: string) {
    const title = editValue.trim();
    if (!title) {
      toast.error("이름을 입력해주세요.");
      return;
    }
    try {
      await updateLegalReviewTitle(id, title);
      cancelEdit();
      qc.invalidateQueries({ queryKey: ["legal-reviews"] });
    } catch (err) {
      toast.error(errorMessage(err, "이름 변경에 실패했습니다."));
    }
  }

  async function handleDelete(id: string) {
    setMenuOpenId(null);
    if (!confirm("이 검토 이력을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    try {
      await deleteLegalReview(id);
      qc.invalidateQueries({ queryKey: ["legal-reviews"] });
      toast.success("삭제되었습니다.");
    } catch (err) {
      toast.error(errorMessage(err, "삭제하지 못했습니다."));
    }
  }

  if (!ready) return null;
  if (!role) return <PasscodeScreen onVerified={setRole} />;

  if (role !== "admin") {
    return (
      <div className="min-h-screen bg-muted/60">
        <AppHeader role={role} onSignOut={signOut} />
        <main className="p-10 text-center text-muted-foreground">
          검토 이력은 관리자만 접근할 수 있습니다.
          <div className="mt-4">
            <Button asChild variant="outline" size="sm">
              <Link to="/">신규 검토로 이동</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/60">
      <AppHeader role={role} onSignOut={signOut} />
      <main className="mx-auto w-full max-w-4xl px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">검토 이력</h1>
            <p className="mt-1 text-sm text-muted-foreground">지금까지 분석한 사안과 작성한 보고서·서면을 다시 확인할 수 있습니다.</p>
          </div>
          <Button asChild size="sm">
            <Link to="/">신규 검토</Link>
          </Button>
        </div>

        <section className="mt-6 divide-y rounded-lg border bg-card">
          {isLoading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">불러오는 중…</p>
          ) : !reviews || reviews.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">검토한 사안이 없습니다.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  {editingId === r.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(r.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="h-8 text-sm"
                      />
                      <Button size="sm" onClick={() => saveEdit(r.id)}>
                        저장
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        취소
                      </Button>
                    </div>
                  ) : (
                    <Link to="/history/$id" params={{ id: r.id }} className="block">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</p>
                    </Link>
                  )}
                </div>
                {editingId !== r.id && (
                  <div className="relative flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {r.analysis?.caseTypes.criminal && <span className="rounded bg-muted px-2 py-0.5">형사</span>}
                    {r.analysis?.caseTypes.civil && <span className="rounded bg-muted px-2 py-0.5">민사</span>}
                    <button
                      type="button"
                      onClick={() => setMenuOpenId((cur) => (cur === r.id ? null : r.id))}
                      className="rounded px-1.5 py-0.5 text-sm leading-none text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="더보기"
                      title="더보기"
                    >
                      ⋯
                    </button>
                    {menuOpenId === r.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-full z-10 mt-1 w-28 overflow-hidden rounded-md border bg-popover py-1 text-left shadow-md"
                      >
                        <button
                          type="button"
                          onClick={() => startEdit(r.id, r.title)}
                          className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                        >
                          이름 변경
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id)}
                          className="block w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-muted"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
