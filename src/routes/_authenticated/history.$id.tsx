import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchLegalReview, deleteLegalReview, fmtDateTime } from "@/lib/legal-review";
import { LegalReviewWorkspace } from "@/components/LegalReviewWorkspace";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/history/$id")({
  head: () => ({ meta: [{ title: "검토 상세 · 사안 검토 시스템" }] }),
  component: HistoryDetailPage,
});

function HistoryDetailPage() {
  const { id } = useParams({ from: "/_authenticated/history/$id" });
  const navigate = useNavigate();
  const { data: review, isLoading } = useQuery({ queryKey: ["legal-review", id], queryFn: () => fetchLegalReview(id) });

  if (isLoading) return <main className="p-10 text-center text-muted-foreground">불러오는 중…</main>;

  if (!review) {
    return (
      <main className="p-10 text-center text-muted-foreground">
        검토 이력을 찾을 수 없습니다.
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/history">목록으로</Link>
          </Button>
        </div>
      </main>
    );
  }

  async function remove() {
    if (!confirm("이 검토 이력을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    try {
      await deleteLegalReview(id);
      toast.success("삭제되었습니다.");
      navigate({ to: "/history" });
    } catch {
      toast.error("삭제하지 못했습니다.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-6">
      <div className="no-print flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{review.title}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">최초 분석 {fmtDateTime(review.created_at)}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/history">목록으로</Link>
          </Button>
          <Button variant="destructive" size="sm" onClick={remove}>
            삭제
          </Button>
        </div>
      </div>
      <div className="mt-6">
        <LegalReviewWorkspace initial={review} />
      </div>
    </main>
  );
}
