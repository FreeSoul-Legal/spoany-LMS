import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { Toaster } from "sonner";

import { PasscodeGateProvider } from "@/lib/access";
import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "법률 상담 시스템" },
      {
        name: "description",
        content: "직영점·본사 부서 검토 요청 사안의 형사·민사 진행 가능성을 분석하고 서면 초안을 작성합니다.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <HeadContent />
      </head>
      <body>
        <PasscodeGateProvider>{children}</PasscodeGateProvider>
        <Toaster richColors position="top-center" />
        <Scripts />
      </body>
    </html>
  );
}
