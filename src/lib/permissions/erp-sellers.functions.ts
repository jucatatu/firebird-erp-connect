import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "./permissions.server";
import { callErp, JsonValue } from "@/lib/erp.server";
import { ErpSeller } from "./admin-types";

interface SellersResponse extends Record<string, JsonValue> {
  success: boolean;
  sellers: (ErpSeller & Record<string, JsonValue>)[];
}

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

    const res = await callErp<SellersResponse>({
      path: "/api/v1/sellers",
      query: {
        q: data.q || "",
        limit: data.limit || 50
      }
    });

    if (!res.ok || !res.data) {
      return [];
    }

    return res.data.sellers;
  });


