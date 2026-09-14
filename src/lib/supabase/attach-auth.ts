import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase/client";

/**
 * 클라이언트에서 서버 함수를 호출할 때 현재 세션의 access_token을
 * Authorization 헤더로 자동 첨부한다. src/start.ts의 functionMiddleware로 등록.
 */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});
