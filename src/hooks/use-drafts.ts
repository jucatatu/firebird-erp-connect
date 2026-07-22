import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OrderDraftStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "sending"
  | "sent"
  | "send_failed"
  | "cancelled";

export interface OrderDraftRow {
  id: string;
  created_by: string;
  updated_by: string;
  status: OrderDraftStatus;
  title: string | null;
  customer_name_snapshot: string | null;
  company_id: number | null;
  payload: Record<string, unknown>;
  idempotency_key: string;
  erp_order_id: number | null;
  erp_order_number: number | null;
  rejection_reason: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  sent_at: string | null;
  send_attempts: number;
  last_send_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderDraftEventRow {
  id: string;
  order_draft_id: string;
  event_type: string;
  previous_status: OrderDraftStatus | null;
  new_status: OrderDraftStatus | null;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useOrderDrafts(filters?: {
  status?: OrderDraftStatus | "all";
  companyId?: 1 | 3 | "all";
  mineOnly?: boolean;
  myUserId?: string | null;
  search?: string;
}) {
  return useQuery({
    queryKey: ["order_drafts", filters],
    queryFn: async () => {
      let q = supabase
        .from("order_drafts")
        .select("*")
        .order("updated_at", { ascending: false });
      if (filters?.status && filters.status !== "all") q = q.eq("status", filters.status);
      if (filters?.companyId && filters.companyId !== "all") q = q.eq("company_id", filters.companyId);
      if (filters?.mineOnly && filters.myUserId) q = q.eq("created_by", filters.myUserId);
      if (filters?.search && filters.search.trim()) {
        const s = `%${filters.search.trim()}%`;
        q = q.or(`title.ilike.${s},customer_name_snapshot.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as OrderDraftRow[];
    },
  });
}

export function useOrderDraft(id: string | undefined) {
  return useQuery({
    queryKey: ["order_draft", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_drafts")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as OrderDraftRow | null;
    },
  });
}

export function useOrderDraftEvents(id: string | undefined) {
  return useQuery({
    queryKey: ["order_draft_events", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_draft_events")
        .select("*")
        .eq("order_draft_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as OrderDraftEventRow[];
    },
  });
}

export interface CreateDraftInput {
  title?: string | null;
  customerName?: string | null;
  companyId?: 1 | 3 | null;
  notes?: string;
}

export function useCreateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDraftInput) => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) throw new Error("Não autenticado");
      const payload = {
        version: 1,
        customer: { id: null, name: input.customerName ?? "" },
        companyId: input.companyId ?? null,
        notes: input.notes ?? "",
        items: [],
        equipment: [],
      };
      const { data, error } = await supabase
        .from("order_drafts")
        .insert({
          created_by: user.id,
          updated_by: user.id,
          status: "draft",
          title: input.title ?? null,
          customer_name_snapshot: input.customerName ?? null,
          company_id: input.companyId ?? null,
          payload,
        })
        .select("*")
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["order_drafts"] });
      qc.invalidateQueries({ queryKey: ["draft-stats"] });
      return data as unknown as OrderDraftRow;
    },
  });
}

export interface UpdateDraftInput {
  id: string;
  title?: string | null;
  customerName?: string | null;
  companyId?: 1 | 3 | null;
  notes?: string;
}

export function useUpdateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateDraftInput) => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) throw new Error("Não autenticado");
      // fetch current payload to preserve nested fields
      const { data: current, error: e0 } = await supabase
        .from("order_drafts")
        .select("payload")
        .eq("id", input.id)
        .single();
      if (e0) throw e0;
      const oldPayload = (current?.payload ?? {}) as Record<string, unknown>;
      const newPayload = {
        ...oldPayload,
        customer: {
          ...((oldPayload.customer as Record<string, unknown> | undefined) ?? {}),
          name: input.customerName ?? null,
        },
        companyId: input.companyId ?? null,
        notes: input.notes ?? (typeof oldPayload.notes === "string" ? oldPayload.notes : "") ?? "",
      };
      const { data, error } = await supabase
        .from("order_drafts")
        .update({
          title: input.title ?? null,
          customer_name_snapshot: input.customerName ?? null,
          company_id: input.companyId ?? null,
          payload: newPayload,
          updated_by: user.id,
        })
        .eq("id", input.id)
        .select("*")
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["order_draft", input.id] });
      qc.invalidateQueries({ queryKey: ["order_drafts"] });
      return data as unknown as OrderDraftRow;
    },
  });
}

export function useTransitionDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; newStatus: OrderDraftStatus; reason?: string | null }) => {
      const { data, error } = await supabase.rpc("update_order_draft_status", {
        _draft_id: args.id,
        _new_status: args.newStatus,
        _reason: args.reason ?? null,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["order_draft", args.id] });
      qc.invalidateQueries({ queryKey: ["order_draft_events", args.id] });
      qc.invalidateQueries({ queryKey: ["order_drafts"] });
      qc.invalidateQueries({ queryKey: ["draft-stats"] });
      return data;
    },
  });
}

export function useDraftStats(scope: {
  role: "admin" | "aprovador" | "vendedor" | null;
  myUserId: string | null;
}) {
  return useQuery({
    queryKey: ["draft-stats", scope],
    enabled: !!scope.myUserId,
    queryFn: async () => {
      const buckets: OrderDraftStatus[] = [
        "draft",
        "pending_approval",
        "approved",
        "sent",
        "send_failed",
      ];
      const result: Record<OrderDraftStatus, number> = {
        draft: 0,
        pending_approval: 0,
        approved: 0,
        rejected: 0,
        sending: 0,
        sent: 0,
        send_failed: 0,
        cancelled: 0,
      };
      for (const s of buckets) {
        let q = supabase
          .from("order_drafts")
          .select("id", { count: "exact", head: true })
          .eq("status", s);
        if (scope.role === "vendedor" && scope.myUserId) q = q.eq("created_by", scope.myUserId);
        const { count, error } = await q;
        if (error) throw error;
        result[s] = count ?? 0;
      }
      return result;
    },
  });
}