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
import { windowStartIso, type MapWindow } from "./history";

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
  /**
   * Estados operacionais cujo `pickup_scheduled_date` bate com a data
   * fornecida — necessário para o mapa unificado (entregas + recolhas)
   * mostrar recolhas agendadas mesmo quando a entrega ocorreu em outro
   * dia. Não filtra por status: quem consome decide o que exibir.
   */
  listPickupsForDate(input: {
    pickupDate: string;
    companyId?: number | null;
  }): Promise<OperationState[]>;
  /**
   * Operações CONCLUÍDAS persistidas no banco operacional, dentro da janela
   * de exibição. Fonte permanente do histórico — independe do ERP/Node.
   */
  listCompleted(input: {
    window: MapWindow;
    companyId?: number | null;
  }): Promise<OperationState[]>;
  /** Busca histórica ampla (não depende da consulta diária do ERP). */
  searchStates(input: {
    term?: string;
    companyId?: number | null;
    limit?: number;
  }): Promise<OperationState[]>;
  /**
   * Complementa o snapshot persistido SEM sobrescrever dados já gravados.
   * Chamado no momento da entrega para congelar cliente/endereço/itens.
   */
  enrichSnapshot(input: {
    stateId: string;
    snapshot: Record<string, unknown>;
  }): Promise<void>;
  getMapWindow(): Promise<MapWindow>;
  setMapWindow(window: MapWindow): Promise<void>;
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
    deliveryTime: src.deliveryTime ?? null,
    latitude: src.latitude ?? null,
    longitude: src.longitude ?? null,
    items: src.items ?? null,
    equipments: src.equipments ?? null,
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

  async listPickupsForDate({ pickupDate, companyId }) {
    let q = db
      .from("operation_states")
      .select("*")
      .eq("pickup_scheduled_date", pickupDate);
    if (companyId != null) q = q.eq("company_id", companyId);
    const res = await q;
    if (res.error) throw res.error;
    return (res.data ?? []) as OperationState[];
  },

  async listCompleted({ window, companyId }) {
    const since = windowStartIso(window);
    let q = db.from("operation_states").select("*");
    if (since) {
      q = q.or(`delivered_at.gte.${since},pickup_completed_at.gte.${since}`);
    } else {
      q = q.or("delivered_at.not.is.null,pickup_completed_at.not.is.null");
    }
    if (companyId != null) q = q.eq("company_id", companyId);
    const res = await q.order("delivered_at", { ascending: false, nullsFirst: false });
    if (res.error) throw res.error;
    return (res.data ?? []) as OperationState[];
  },

  async searchStates({ term, companyId, limit = 200 }) {
    let q = db.from("operation_states").select("*");
    if (companyId != null) q = q.eq("company_id", companyId);
    const n = Number(term);
    if (term && Number.isInteger(n) && n > 0) {
      q = q.or(`erp_order_number.eq.${n},erp_order_id.eq.${n}`);
    } else if (term && term.trim()) {
      q = q.ilike("snapshot->>customerName", `%${term.trim()}%`);
    }
    const res = await q.order("created_at", { ascending: false }).limit(limit);
    if (res.error) throw res.error;
    return (res.data ?? []) as OperationState[];
  },

  async enrichSnapshot({ stateId, snapshot }) {
    const cur = await db
      .from("operation_states")
      .select("snapshot, delivered_at, pickup_completed_at")
      .eq("id", stateId)
      .maybeSingle();
    if (cur.error) throw cur.error;
    const existing = (cur.data?.snapshot ?? {}) as Record<string, unknown>;
    // Congelado a partir da 1ª conclusão (delivered_at / pickup_completed_at).
    // Antes disso o snapshot é rascunho e pode ser atualizado pelo ERP.
    const frozen =
      cur.data?.delivered_at != null || cur.data?.pickup_completed_at != null;
    const { mergeSnapshot } = await import("./history");
    const merged = mergeSnapshot(existing, snapshot, frozen);
    const res = await db
      .from("operation_states")
      .update({ snapshot: merged })
      .eq("id", stateId);
    if (res.error) throw res.error;
  },

  async getMapWindow() {
    const { parseMapWindow } = await import("./history");
    try {
      const res = await db
        .from("app_settings")
        .select("value")
        .eq("key", "map_completed_window_days")
        .maybeSingle();
      // Erro de consulta, chave ausente ou JSON fora do formato → fallback 7 dias.
      if (res.error) return parseMapWindow(undefined);
      const raw = (res.data?.value ?? {}) as { days?: unknown };
      return parseMapWindow(raw?.days);
    } catch {
      return parseMapWindow(undefined);
    }
  },

  async setMapWindow(window) {
    const { data: userRes } = await supabase.auth.getUser();
    const res = await db
      .from("app_settings")
      .upsert(
        {
          key: "map_completed_window_days",
          value: { days: window === "always" ? "always" : window },
          updated_by: userRes.user?.id ?? null,
        },
        { onConflict: "key" },
      );
    if (res.error) throw res.error;
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