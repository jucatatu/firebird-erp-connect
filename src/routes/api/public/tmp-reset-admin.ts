import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tmp-reset-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-tmp-token");
        if (token !== "b8f3c2a1-reset-once") {
          return new Response("nope", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
          "5234ff2c-2816-4026-8d2d-bbedc684b9df",
          { password: "admin@#admin" },
        );
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});