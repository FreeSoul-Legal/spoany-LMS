import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchMe, signIn } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LegalReviewWorkspace } from "@/components/LegalReviewWorkspace";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexPage,
});

function IndexPage() {
  const { data: me, isLoading, refetch } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader me={me ?? undefined} />
      {isLoading ? (
        <main className="p-10 text-center text-muted-foreground">불러오는 중…</main>
      ) : !me ? (
        <LoginScreen onSignedIn={() => refetch()} />
      ) : !me.isAllowed ? (
        <main className="mx-auto w-full max-w-md px-6 py-20 text-center">
          <h1 className="text-lg font-bold">접근 권한이 없습니다</h1>
          <p className="mt-2 text-sm text-muted-foreground">이 시스템은 담당자 계정에서만 이용할 수 있습니다.</p>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-4xl px-6 py-6">
          <h1 className="text-lg font-bold">사안 검토</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            직영점(헬스장)이나 본사 각 부서에서 검토를 요청한 사안을 입력하면, 형사·민사 진행 가능성을 분석하고
            필요한 보고서와 서면 초안을 작성합니다.
          </p>
          <div className="mt-6">
            <LegalReviewWorkspace />
          </div>
        </main>
      )}
    </div>
  );
}

function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      onSignedIn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="text-base font-semibold">로그인</h1>
        <p className="mt-1 text-sm text-muted-foreground">담당자 계정으로 로그인하세요.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">이메일</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "로그인 중…" : "로그인"}
          </Button>
        </form>
      </div>
    </main>
  );
}
