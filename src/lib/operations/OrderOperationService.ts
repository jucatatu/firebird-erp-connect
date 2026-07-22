import { supabase } from "@/integrations/supabase/client";
import type {
  OperationState,
  OperationEvent,
  OperationNote,
  OperationalStatus,
  OrderSnapshotInput,
} from "./types";

/**
 * Interface pública das ações operacionais. Deve permanecer independente
 * de transporte (Supabase, HTTP, etc). O adapter atual grava no Lovable
 * Cloud; um `ErpOrderOperationService` futuro poderá enviar ao Firebird
 * sem alterar chamadas do frontend.
 */
export interface OrderOperationService {
  ensureState(input: OrderSnapshotInput): Promise<OperationState>;
  startOrder(stateId: string): Promise<OperationState>;
  markDelivered(stateId: string): Promise<OperationState>;
  markCollected(stateId: string): Promise<OperationState>;
  markCustomerWillCall(stateId: string): Promise<OperationState>;
  markNotFound(stateId: string): Promise<OperationState>;
  reschedule(input: {
    stateId: string;
    newDate: string;
    reason: string;
  }): Promise<OperationState>;
  addNote(input: { stateId: string; body: string }): Promise<OperationNote>;
  reorder(input: {
    operationDate: string;
    orderedStateIds: string[];
  }): Promise<void>;
  listStates(input: {
    operationDate: string;
    companyId?: number | null;
  }): Promise<OperationState[]>;
  listEvents(stateId: string): Promise<OperationEvent[]>;
  listNotes(stateId: string): Promise<OperationNote[]>;
}

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error as Error;
  return res.data as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function updateStatus(
  stateId: string,
  status: OperationalStatus,
): Promise<OperationState> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id ?? null;
  const res = await db
    .from("operation_states")
    .update({ operational_status: status, updated_by: uid })
    .eq("id", stateId)
    .select("*")
    .single();
  return unwrap<OperationState>(res);
}

export const LocalOrderOperationService: OrderOperationService = {
  async ensureState(input) {
    const existing = await db
      .from("operation_states")
      .select("*")
      .eq("operation_date", input.operationDate)
      .eq("erp_order_id", input.erpOrderId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return existing.data as OperationState;

    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) throw new Error("Não autenticado");
    const res = await db
      .from("operation_states")
      .insert({
        erp_order_id: input.erpOrderId,
        erp_order_number: input.erpOrderNumber ?? null,
        company_id: input.companyId ?? null,
        operation_date: input.operationDate,
        snapshot: input.snapshot ?? {
          customerName: input.customerName ?? null,
          address: input.address ?? null,
          phone: input.phone ?? null,
        },
        created_by: uid,
      })
      .select("*")
      .single();
    return unwrap<OperationState>(res);
  },

  startOrder: (id) => updateStatus(id, "in_progress"),
  markDelivered: (id) => updateStatus(id, "delivered"),
  markCollected: (id) => updateStatus(id, "collected"),
  markCustomerWillCall: (id) => updateStatus(id, "customer_will_call"),
  markNotFound: (id) => updateStatus(id, "not_found"),

  async reschedule({ stateId, newDate, reason }) {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id ?? null;
    const res = await db
      .from("operation_states")
      .update({
        operational_status: "rescheduled",
        operational_date: newDate,
        reschedule_reason: reason,
        updated_by: uid,
      })
      .eq("id", stateId)
      .select("*")
      .single();
    return unwrap<OperationState>(res);
  },

  async addNote({ stateId, body }) {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) throw new Error("Não autenticado");
    const noteRes = await db
      .from("operation_notes")
      .insert({ operation_state_id: stateId, body, author_id: uid })
      .select("*")
      .single();
    const note = unwrap<OperationNote>(noteRes);
    // Trigger não cobre inserção de nota — log manual do evento.
    await db.from("operation_events").insert({
      operation_state_id: stateId,
      event_type: "note_added",
      description: body.slice(0, 120),
      actor_id: uid,
      origin: "local",
    });
    return note;
  },

  async reorder({ operationDate, orderedStateIds }) {
    // Atualização em batch: cada linha recebe sequence conforme posição.
    await Promise.all(
      orderedStateIds.map((id, idx) =>
        db
          .from("operation_states")
          .update({ sequence: idx + 1 })
          .eq("id", id)
          .eq("operation_date", operationDate),
      ),
    );
  },

  async listStates({ operationDate, companyId }) {
    let q = db
      .from("operation_states")
      .select("*")
      .eq("operation_date", operationDate);
    if (companyId != null) q = q.eq("company_id", companyId);
    const res = await q.order("sequence", { ascending: true, nullsFirst: false });
    if (res.error) throw res.error;
    return (res.data ?? []) as OperationState[];
  },

  async listEvents(stateId) {
    const res = await db
      .from("operation_events")
      .select("*")
      .eq("operation_state_id", stateId)
      .order("created_at", { ascending: true });
    if (res.error) throw res.error;
    return (res.data ?? []) as OperationEvent[];
  },

  async listNotes(stateId) {
    const res = await db
      .from("operation_notes")
      .select("*")
      .eq("operation_state_id", stateId)
      .order("created_at", { ascending: true });
    if (res.error) throw res.error;
    return (res.data ?? []) as OperationNote[];
  },
};

/**
 * Stub — futura implementação que envia ações ao ERP via Node.
 * Deliberadamente não implementada nesta fase.
 */
export const ErpOrderOperationService: OrderOperationService = new Proxy(
  {} as OrderOperationService,
  {
    get() {
      return async () => {
        throw new Error(
          "ErpOrderOperationService ainda não implementado — envio ao Firebird será feito em fase futura.",
        );
      };
    },
  },
);

export const operationService: OrderOperationService = LocalOrderOperationService;