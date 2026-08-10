import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRecentOrderDrafts(userId: string | undefined, companyId: number | null) {
  return useQuery({
    queryKey: ["order_drafts", "recent", userId, companyId],
    queryFn: async () => {
      if (!userId) return [];
      
      let query = supabase
        .from("order_drafts")
        .select("*")
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(7);
      
      if (companyId) {
        query = query.eq("company_id", companyId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}
