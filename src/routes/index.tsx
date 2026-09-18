import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { LegalReviewWorkspace } from "@/components/LegalReviewWorkspace";
import { PasscodeScreen } from "@/components/PasscodeScreen";
import { usePasscodeGate } from "@/lib/access";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "민형사 검토 시스템" },
      {
        name: "description",
        content: "직영점·본사 부서 검토 요청 사안의 형사·민사 진행 가능성을 분석하고 서면 초안을 작성합니다.",
      },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const { role, ready, setRole, signOut } = usePasscodeGate();

  if (!ready) return null;
  if (!role) return <PasscodeScreen onVerified={setRole} />;

  return (
    <div className="min-h-screen bg-muted/60">
      <AppHeader role={role} onSignOut={signOut} />
      <main className="mx-auto w-full max-w-4xl px-6 py-6">
        <h1 className="text-lg font-bold">사안 검토</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          각 부서에서 검토를 요청한 사안을 입력하면, 형사·민사 진행 가능성을 분석하고 필요한 보고서와 서면 초안을
          작성합니다.
        </p>
        <div className="mt-6">
          <LegalReviewWorkspace />
        </div>
      </main>
    </div>
  );
}
