import { supabase } from "@/integrations/supabase/client";
import {
  OPERATION_CONFLICT_CODE,
  OperationConflictError,
  SNAPSHOT_FIELDS,
  type OperationState,
  type OperationEvent,
  type OperationNote,
  type OrderSnapshotInput,
  type SnapshotField,
} from "./types";
import type { OperationAction } from "./state-machine";

/**
 * Interface pública das ações operacionais. Deve permanecer independente
 * de transporte (Supabase, HTTP, etc). O adapter atual grava no Lovable
 * Cloud via RPC (matriz de transições + versão otimista); um
 * `ErpOrderOperationService` futuro poderá enviar ao Firebird sem
 * alterar chamadas do frontend.
 */
export interface OrderOperationService {
  ensureState(input: OrderSnapshotInput): Promise<OperationState>;
  transition(input: {
    stateId: string;
    action: OperationAction;
    expectedVersion: number;
    payload?: Record<string, unknown>;
  }): Promise<OperationState>;
  assignOperator(input: {
    stateId: string;
    role: "delivery" | "pickup";
    userId: string;
    expectedVersion: number;
  }): Promise<OperationState>;
  listProfiles(): Promise<Array<{ id: string; full_name: string | null }>>;
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
  if (res.error) throw normalizeError(res.error);
  return res.data as T;
}

function normalizeError(err: unknown): Error {
  const e = err as { code?: string; message?: string };
  if (e?.code === OPERATION_CONFLICT_CODE || /operation_state_conflict/i.test(e?.message ?? "")) {
    return new OperationConflictError();
  }
  return err as Error;
}

// Snapshot mínimo: apenas campos necessários para continuidade operacional.
// NÃO persiste credenciais, dados financeiros, itens/equipamentos, documentos
// ou conteúdo não exibido na operação. Ver SNAPSHOT_FIELDS em types.ts.
function buildSnapshot(input: OrderSnapshotInput): Record<string, unknown> {
  const src = (input.snapshot ?? {}) as Record<string, unknown>;
  const merged: Partial<Record<SnapshotField, unknown>> = {
    customerName: input.customerName ?? null,
    address: input.address ?? null,
    phone: input.phone ?? null,
    orderNumber: input.erpOrderNumber ?? null,
    deliveryDate: src.deliveryDate ?? null,
    period: src.period ?? null,
  };
  const out: Record<string, unknown> = {};
  for (const f of SNAPSHOT_FIELDS) {
    const v = merged[f];
    if (v !== undefined && v !== null && v !== "") out[f] = v;
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const LocalOrderOperationService: OrderOperationService = {
  async ensureState(input) {
    // Chave única agora é (company_id, erp_order_id); reagendamentos NÃO
    // criam novo estado — mudam operational_date do mesmo registro.
    let q = db
      .from("operation_states")
      .select("*")
      .eq("erp_order_id", input.erpOrderId);
    if (input.companyId == null) {
      q = q.is("company_id", null);
    } else {
      q = q.eq("company_id", input.companyId);
    }
    const existing = await q.maybeSingle();
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
        snapshot: buildSnapshot(input),
        created_by: uid,
        has_returnable_equipment: input.hasReturnableEquipment ?? false,
      })
      .select("*")
      .single();
    return unwrap<OperationState>(res);
  },

  async transition({ stateId, action, expectedVersion, payload }) {
    const res = await db.rpc("apply_operation_transition", {
      _state_id: stateId,
      _action: action,
      _expected_version: expectedVersion,
      _payload: payload ?? {},
    });
    if (res.error) throw normalizeError(res.error);
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    return row as OperationState;
  },

  async assignOperator({ stateId, role, userId, expectedVersion }) {
    const res = await db.rpc("assign_operation_operator", {
      _state_id: stateId,
      _role: role,
      _user_id: userId,
      _expected_version: expectedVersion,
    });
    if (res.error) throw normalizeError(res.error);
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    return row as OperationState;
  },

  async listProfiles() {
    const res = await db
      .from("profiles")
      .select("id, full_name")
      .eq("active", true)
      .order("full_name", { ascending: true });
    if (res.error) throw res.error;
    return (res.data ?? []) as Array<{ id: string; full_name: string | null }>;
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
    // Note não tem trigger — registra evento único aqui.
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
    // Um pedido reagendado deve APARECER apenas na nova data operacional
    // e DESAPARECER da antiga. Se operational_date estiver preenchido,
    // ele é a agenda efetiva; caso contrário usa operation_date (data do ERP).
    let q = db
      .from("operation_states")
      .select("*")
      .or(
        `operational_date.eq.${operationDate},and(operational_date.is.null,operation_date.eq.${operationDate})`,
      );
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