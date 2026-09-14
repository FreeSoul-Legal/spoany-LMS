import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

/**
 * 서버 함수(createServerFn) 호출을 검증하는 미들웨어.
 * 클라이언트가 첨부한 Authorization: Bearer <access_token> 을 검증해
 * 호출자의 userId/claims 및 RLS가 적용된 supabase 클라이언트를 context로 내려준다.
 */
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("서버 환경변수 SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY가 설정되어 있지 않습니다.");
  }

  const request = getRequest();
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized: 인증 토큰이 없습니다.");
  }
  const token = authHeader.slice("Bearer ".length);
  if (token.split(".").length !== 3) {
    throw new Error("Unauthorized: 잘못된 토큰입니다.");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims.sub) {
    throw new Error("Unauthorized: 유효하지 않은 토큰입니다.");
  }

  return next({
    context: {
      supabase,
      userId: data.claims.sub,
      claims: data.claims,
    },
  });
});
