import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyPasscode } from "@/lib/access";
import type { Role } from "@/lib/access";

export function PasscodeScreen({ onVerified }: { onVerified: (role: Role) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const role = verifyPasscode(code);
    if (!role) {
      setError(true);
      return;
    }
    onVerified(role);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-primary" aria-hidden="true">
            <path
              d="M12 3l7 3v5c0 4.5-3 8.2-7 9-4-.8-7-4.5-7-9V6l7-3z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="mt-4 text-lg font-bold">법률 상담 시스템</h1>
        <p className="mt-1 text-sm text-muted-foreground">시스템에 접속하려면 인증이 필요합니다</p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(false);
            }}
            placeholder="비밀번호를 입력하세요"
            className="text-center"
          />
          {error && <p className="text-xs text-destructive">인증번호가 올바르지 않습니다.</p>}
          <Button type="submit" className="w-full">
            인증하기
          </Button>
        </form>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          ⚠ 본 시스템은 인가된 사용자만 접근할 수 있습니다.
          <br />
          무단 접근 시 법적 책임을 질 수 있습니다.
        </p>
      </div>
    </div>
  );
}
