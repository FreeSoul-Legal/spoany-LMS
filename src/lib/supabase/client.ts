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
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
