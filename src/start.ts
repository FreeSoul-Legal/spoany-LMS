import { createStart, createCsrfMiddleware } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/lib/supabase/attach-auth";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [csrfMiddleware],
}));
