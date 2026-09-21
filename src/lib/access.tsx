// 간단한 인증번호 기반 접근 제어. 실제 로그인 계정 시스템이 아니라, 이 URL을
// 아는 사람 중에서도 인증번호를 아는 사람만 쓰게 하는 가벼운 잠금장치다.
// 상태를 브라우저에 저장하지 않고 메모리에만 두므로, 새로고침하거나 브라우저를
// 새로 열 때마다 다시 인증해야 한다(같은 화면 안에서 메뉴를 이동하는 동안에는 유지됨).
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export type Role = "user" | "admin";

const CODES: Record<string, Role> = {
  "371428": "user",
  "37142856": "admin",
};

export function verifyPasscode(code: string): Role | null {
  return CODES[code.trim()] ?? null;
}

type GateContextValue = {
  role: Role | null;
  setRole: (role: Role) => void;
  signOut: () => void;
};

const GateContext = createContext<GateContextValue | null>(null);

export function PasscodeGateProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  return <GateContext.Provider value={{ role, setRole, signOut: () => setRole(null) }}>{children}</GateContext.Provider>;
}

/** 페이지 진입 시 인증 여부를 확인하고, 로그아웃(재잠금) 기능을 제공한다. */
export function usePasscodeGate() {
  const ctx = useContext(GateContext);
  if (!ctx) throw new Error("usePasscodeGate는 PasscodeGateProvider 내부에서만 사용할 수 있습니다.");
  return { role: ctx.role, ready: true, setRole: ctx.setRole, signOut: ctx.signOut };
}
