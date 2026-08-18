import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "./permissions.server";
import { fetchErp } from "@/lib/erp.server";

export const searchErpSellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ q: z.string().optional(), limit: z.number().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await requirePermission({
      userId,
      resource: "admin.users",
      action: "view",
      supabase
    });

    const sellers = await fetchErp("/api/v1/sellers", {
      q: data.q || "",
      limit: data.limit || 50
    });

    return sellers;
  });
