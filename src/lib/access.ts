// 간단한 인증번호 기반 접근 제어. 실제 로그인 계정 시스템이 아니라, 이 URL을
// 아는 사람 중에서도 인증번호를 아는 사람만 쓰게 하는 가벼운 잠금장치다.
// 브라우저(localStorage)에만 상태가 남으므로 완전한 보안 수단은 아니다.
import { useEffect, useState } from "react";

export type Role = "user" | "admin";

const STORAGE_KEY = "spoany-lms-role";

const CODES: Record<string, Role> = {
  "371428": "user",
  "37142856": "admin",
};

export function verifyPasscode(code: string): Role | null {
  return CODES[code.trim()] ?? null;
}

export function getStoredRole(): Role | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "user" || v === "admin" ? v : null;
}

export function setStoredRole(role: Role) {
  window.localStorage.setItem(STORAGE_KEY, role);
}

export function clearStoredRole() {
  window.localStorage.removeItem(STORAGE_KEY);
}

/** 페이지 진입 시 인증 여부를 확인하고, 로그아웃(재잠금) 기능을 제공한다. */
export function usePasscodeGate() {
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRole(getStoredRole());
    setReady(true);
  }, []);

  function signOut() {
    clearStoredRole();
    setRole(null);
  }

  return { role, ready, setRole, signOut };
}
