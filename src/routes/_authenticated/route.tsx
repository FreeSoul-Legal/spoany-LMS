import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { fetchMe } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { error } = await supabase.auth.getUser();
    if (error) throw redirect({ to: "/" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  return (
    <div className="min-h-screen bg-muted/60">
      <AppHeader me={me ?? undefined} />
      {me && !me.isAllowed ? (
        <main className="mx-auto w-full max-w-md px-6 py-20 text-center">
          <h1 className="text-lg font-bold">접근 권한이 없습니다</h1>
          <p className="mt-2 text-sm text-muted-foreground">이 시스템은 담당자 계정에서만 이용할 수 있습니다.</p>
        </main>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
