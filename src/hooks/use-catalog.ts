import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  CatalogItemType,
  CatalogSetting,
  CatalogSettingDraft,
} from "@/lib/catalog/types";
import { translateCatalogError, validateDraft } from "@/lib/catalog/types";

/** Configurações locais do catálogo (Supabase). O ERP segue como fonte dos cadastros. */
export function useCatalogSettings(itemType?: CatalogItemType) {
  return useQuery({
    queryKey: ["catalog", "settings", itemType ?? "all"],
    queryFn: async (): Promise<CatalogSetting[]> => {
      let q = supabase
        .from("order_catalog_settings")
        .select(
          "id, item_type, erp_item_id, erp_description_snapshot, display_name, enabled, company_ids, sort_order, default_quantity, quantity_step, requires_pickup, version, updated_at",
        )
        .order("sort_order", { ascending: true })
        .order("erp_item_id", { ascending: true });
      if (itemType) q = q.eq("item_type", itemType);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CatalogSetting[];
    },
  });
}

export function useUpsertCatalogSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: CatalogSettingDraft): Promise<CatalogSetting> => {
      const localError = validateDraft(draft);
      if (localError) throw new Error(localError);
      const { data, error } = await supabase.rpc("upsert_order_catalog_setting", {
        _item_type: draft.itemType,
        _erp_item_id: draft.erpItemId,
        _erp_description_snapshot: draft.erpDescriptionSnapshot.trim(),
        _enabled: draft.enabled,
        _company_ids: draft.companyIds,
        _sort_order: draft.sortOrder,
        _default_quantity: draft.defaultQuantity,
        _quantity_step: draft.quantityStep,
        _display_name: draft.displayName?.trim() ? draft.displayName.trim() : undefined,
        _requires_pickup: draft.requiresPickup ?? undefined,
        _expected_version: draft.expectedVersion ?? undefined,
      });
      if (error) throw new Error(translateCatalogError(error.message));
      return data as unknown as CatalogSetting;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog", "settings"] });
      qc.invalidateQueries({ queryKey: ["catalog", "history"] });
    },
  });
}

export interface CatalogEvent {
  id: string;
  event_type: string;
  created_at: string;
  actor_id: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
}

export function useCatalogHistory(itemType: CatalogItemType | null, erpItemId: number | null) {
  return useQuery({
    queryKey: ["catalog", "history", itemType, erpItemId],
    enabled: Boolean(itemType && erpItemId),
    queryFn: async (): Promise<CatalogEvent[]> => {
      const { data, error } = await supabase
        .from("order_catalog_setting_events")
        .select("id, event_type, created_at, actor_id, previous_value, new_value")
        .eq("item_type", itemType!)
        .eq("erp_item_id", erpItemId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as CatalogEvent[];
    },
  });
}