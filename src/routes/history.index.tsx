import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchLegalReviews, fmtDateTime } from "@/lib/legal-review";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/history/")({
  head: () => ({
    meta: [
      { title: "검토 이력 · 사안 검토 시스템" },
      { name: "description", content: "지금까지 분석한 사안과 작성한 보고서·서면을 다시 확인합니다." },
    ],
  }),
  component: HistoryListPage,
});

function HistoryListPage() {
  const { data: reviews, isLoading } = useQuery({ queryKey: ["legal-reviews"], queryFn: fetchLegalReviews });

  return (
    <div className="min-h-screen bg-muted/60">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">검토 이력</h1>
            <p className="mt-1 text-sm text-muted-foreground">지금까지 분석한 사안과 작성한 보고서·서면을 다시 확인할 수 있습니다.</p>
          </div>
          <Button asChild size="sm">
            <Link to="/">새 사안 검토</Link>
          </Button>
        </div>

        <section className="mt-6 divide-y rounded-lg border bg-card">
          {isLoading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">불러오는 중…</p>
          ) : !reviews || reviews.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">검토한 사안이 없습니다.</p>
          ) : (
            reviews.map((r) => (
              <Link
                key={r.id}
                to="/history/$id"
                params={{ id: r.id }}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</p>
                </div>
                <div className="flex shrink-0 gap-1 text-xs text-muted-foreground">
                  {r.analysis?.caseTypes.criminal && <span className="rounded bg-muted px-2 py-0.5">형사</span>}
                  {r.analysis?.caseTypes.civil && <span className="rounded bg-muted px-2 py-0.5">민사</span>}
                </div>
              </Link>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
