// 서버 전용 Supabase 클라이언트(서비스 롤 키, RLS 우회).
// 이 앱은 로그인 화면 없이 단일 사용자가 사용하므로, 데이터베이스 접근은
// 전부 서버 함수(legal-review.functions.ts)에서 이 클라이언트로만 수행한다.
// 절대 클라이언트(브라우저) 번들에 포함되면 안 된다 — *.server.ts 파일에서만 import.
import { createClient } from "@supabase/supabase-js";

function createSupabaseAdmin() {
  const url = process.env["SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !serviceRoleKey) {
    throw new Error("서버 환경변수 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않습니다.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let _admin: ReturnType<typeof createSupabaseAdmin> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdmin>, {
  get(_, prop, receiver) {
    if (!_admin) _admin = createSupabaseAdmin();
    return Reflect.get(_admin, prop, receiver);
  },
});
