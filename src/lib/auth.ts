import { supabase } from "@/lib/supabase/client";
import { ALLOWED_EMAIL } from "@/lib/legal-review.functions";

export type Me = {
  user: { id: string; email: string | null };
  isAllowed: boolean;
} | null;

export async function fetchMe(): Promise<Me> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  return {
    user: { id: user.id, email: user.email ?? null },
    isAllowed: user.email === ALLOWED_EMAIL,
  };
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  try {
    await supabase.auth.signOut();
  } catch {
    // 세션이 이미 만료된 경우에도 로그아웃 흐름은 계속 진행한다.
  }
}
