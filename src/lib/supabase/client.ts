// 브라우저에서 직접 쓰는 Supabase 클라이언트(공개용 publishable/anon 키).
// 로그인 화면이 없는 단일 사용자 도구이므로, legal_reviews 테이블은
// RLS에서 anon 역할에 전체 접근을 허용해두었다(마이그레이션 참고).
import { createClient } from "@supabase/supabase-js";

function createSupabaseClient() {
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

  if (!url || !key) {
    throw new Error(
      "Supabase 환경변수가 설정되어 있지 않습니다. VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY를 확인해주세요.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
