// Execute esta instrucao no projeto: SPRINT 7.1 — HOMOLOGAÇÃO REAL DA CRIAÇÃO DE PEDIDOS
//
// A Sprint 7 foi implementada na ERP API v1.8.0.
//
// Não criar funcionalidades novas nesta Sprint.
//
// Objetivo exclusivo:
// Validar o POST /api/v1/orders contra o Firebird real e comprovar que o pedido criado pelo Node é equivalente a um pedido criado normalmente pelo ERP.
//
// Não alterar procedures, triggers, generators, tabelas ou schema do Firebird.
//
// ────────────────────────────────────────
// 1. PRÉ-VALIDAÇÃO
// ────────────────────────────────────────
// Antes de criar qualquer pedido, confirmar no Firebird real:
// - assinatura real de cada procedure (SP_CAD_ORDEM_VENDA_COMPLETO, SP_CAD_ITENS_ORDENS_VENDA, SP_CAD_EQUIP_ORDENS_VENDA);
// - ordem e tipo dos parâmetros;
// - existência do usuário ID_USER = 2;
// - significado operacional de GERA_COBRANCA = 1 e SAIDA_ESTOQUE.
//
// ────────────────────────────────────────
// 2. TESTE GRAAL — PEDIDO MÍNIMO
// ────────────────────────────────────────
// Criar um único pedido controlado para ID_EMPRESA = 1.
// Releitura pós-COMMIT validando campo por campo.
//
// (Roteiro completo de homologação, itens, N_PEDIDO, histórico, cobrança, ID_USER, endereço, idempotência e rollback registrado no briefing).

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MapView, type MapMarkerData } from "@/components/map-view";
import {
  OperationalFilters,
  filterOfStatus,
  type OperationalFilter,
} from "@/components/operation/operational-filters";
import { OperationalCounters } from "@/components/operation/operational-counters";
import { OrderDetailSheet } from "@/components/operation/order-detail-sheet";
import { useGeocodeOrders, useMapOrders } from "@/hooks/use-erp";
import {
  useCompletedStates,
  useMapWindow,
  useOperationStates,
  usePickupStatesForDate,
  useProfiles,
} from "@/hooks/use-operations";
import {
  dedupeBy,
  isWithinCompletedWindow,
  mapWindowLabel,
  type MapWindow,
} from "@/lib/operations/history";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { isMappable, normalizeMapOrder, type MapOrder, type NormalizedMapOrder } from "@/lib/erp.functions";
import { resolveDeliveryTime } from "@/lib/delivery-time";
import {
  ATTENTION_RED,
  pickupPeriodAbbrev,
  publicStatusColor,
  publicStatusLabel,
  type OperationState,
  type OperationalStatus,
} from "@/lib/operations/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, List, MapPin, Search, MapPinOff, Loader2, WifiOff, User, Info, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Mapa operacional — ERP" },
      { name: "description", content: "Pedidos, entregas e recolhas em um mapa único." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MapHome,
});

type CompanyChoice = "all" | "1" | "3";
type SortKey = "manual" | "customer" | "city" | "status" | "number";

interface EnrichedOrder {
  order: NormalizedMapOrder;
  key: string;
  erpId: number;
  state: OperationState | null;
  status: OperationalStatus;
  opType: "delivery" | "pickup";
  /** Só para pickups: data agendada usada como referência de atraso. */
  scheduledDate?: string | null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}


function fallbackOrderFromState(s: OperationState): NormalizedMapOrder {
  const snap = (s.snapshot ?? {}) as Record<string, unknown>;
  const address = typeof snap.address === "string" ? snap.address : "";
  const lat = typeof snap.latitude === "number" ? snap.latitude : null;
  const lng = typeof snap.longitude === "number" ? snap.longitude : null;
  return {
    key: `state-${s.id}`,
    erpOrderId: Number(s.erp_order_id),
    orderNumber: String(s.erp_order_number ?? s.erp_order_id),
    companyId: s.company_id,
    customerName: typeof snap.customerName === "string" ? snap.customerName : "(sem dados do ERP)",
    phone: typeof snap.phone === "string" ? snap.phone : null,
    address: {
      formatted: address, street: address, number: "", complement: "",
      district: "", city: "", state: "",
    },
    observations: null, erpStatus: null,
    deliveryDate: typeof snap.deliveryDate === "string" ? snap.deliveryDate : null,
    returnDate: null,
    period: typeof snap.period === "string" ? snap.period : null,
    deliveryTime: typeof snap.deliveryTime === "string" ? snap.deliveryTime : null,
    items: Array.isArray(snap.items) ? (snap.items as NormalizedMapOrder["items"]) : [],
    equipments: Array.isArray(snap.equipments)
      ? (snap.equipments as NormalizedMapOrder["equipments"])
      : [],
    location: {
      latitude: lat, longitude: lng, locationType: "", precision: "",
      placeId: "", matchMismatch: false,
      source: lat != null && lng != null ? "cache" : "unresolved",
      cacheKey: "",
    },
    malformed: false, raw: {},
  };
}

function MapHome() {
  return <MapHomeInner />;
}

/**
 * Escopo do filtro "Concluídos": janela configurada (padrão) ou histórico
 * completo. Nunca afeta retenção — só a visibilidade no mapa.
 */
function CompletedScopeToggle({
  scope,
  onChange,
  window: w,
}: {
  scope: "window" | "all";
  onChange: (s: "window" | "all") => void;
  window: MapWindow;
}) {
  return (
    <div className="mt-2 flex items-center gap-1 text-[11px]">
      <button
        type="button"
        onClick={() => onChange("window")}
        className={cn(
          "rounded-full border px-2 py-1 transition-colors",
          scope === "window" ? "bg-primary text-primary-foreground" : "bg-surface",
        )}
      >
        Período configurado ({mapWindowLabel(w).toLowerCase()})
      </button>
      <button
        type="button"
        onClick={() => onChange("all")}
        className={cn(
          "rounded-full border px-2 py-1 transition-colors",
          scope === "all" ? "bg-primary text-primary-foreground" : "bg-surface",
        )}
      >
        Todos os concluídos
      </button>
    </div>
  );
}

function MapHomeInner() {
  const [date, setDate] = useState<string>(today());
  const [company, setCompany] = useState<CompanyChoice>("all");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OperationalFilter>("all");
  const [sort, setSort] = useState<SortKey>("manual");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [detailOpen, setDetailOpen] = useState(false);
  // Contador que força remount do sheet ao reabrir o mesmo pedido —
  // corrige o bug em que o mesmo marcador não reabria após fechar.
  const [openSeq, setOpenSeq] = useState(0);
  // Card operacional exibido ao tocar num marcador (antes de abrir o sheet).
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  // Escopo do filtro "Concluídos": janela configurada ou histórico completo.
  const [completedScope, setCompletedScope] = useState<"window" | "all">("window");

  const online = useNetworkStatus();
  const companyId = company === "all" ? undefined : (Number(company) as 1 | 3);

  const ordersQ = useMapOrders({ date, companyId });
  const statesQ = useOperationStates(date, companyId ?? null);
  const pickupsQ = usePickupStatesForDate(date, companyId ?? null);
  const mapWindowQ = useMapWindow();
  const mapWindow: MapWindow = mapWindowQ.data ?? 7;
  // 3ª fonte do mapa: operações já concluídas persistidas no banco
  // operacional. Independem do ERP retornar o pedido na data.
  const completedQ = useCompletedStates(
    completedScope === "all" ? "always" : mapWindow,
    companyId ?? null,
  );
  const profilesQ = useProfiles();
  const geocodeM = useGeocodeOrders();
  const qc = useQueryClient();

  // Controle anti-loop: IDs internos já tentados nesta sessão (por data).
  // Reseta quando a data muda para permitir novas tentativas do dia seguinte.
  const attemptedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    attemptedRef.current = new Set();
  }, [date]);

  const payload = ordersQ.data?.data ?? null;
  const rawOrders: MapOrder[] = useMemo(() => payload?.orders ?? [], [payload]);
  const geoSummary = payload?.summary ?? { total: 0, mapped: 0, pending: 0, unresolved: 0 };
  const erpError = ordersQ.data && !ordersQ.data.ok ? ordersQ.data.error : null;

  // Normaliza defensivamente antes do render. Uma linha malformada é
  // rebaixada a placeholder e sinalizada por `malformed`, mas nunca
  // interrompe a página inteira.
  const normalizedOrders: NormalizedMapOrder[] = useMemo(
    () => rawOrders.map((o, idx) => normalizeMapOrder(o, idx)),
    [rawOrders],
  );

  // Mapa unificado: combina duas agendas na mesma data:
  //   1) ENTREGAS: pedidos do ERP com previsão para `date`.
  //   2) RECOLHAS: estados operacionais cujo pickup_scheduled_date === date,
  //      mesmo que a entrega tenha ocorrido em outro dia.
  // Um pedido pode aparecer nas duas listas (entrega e recolha no mesmo dia)
  // — desambiguado por `opType` para não sobrepor marcadores idênticos.
  const enrichedAll: EnrichedOrder[] = useMemo(() => {
    const stateByErpId = new Map<number, OperationState>();
    (statesQ.data ?? []).forEach((s) => stateByErpId.set(Number(s.erp_order_id), s));
    (pickupsQ.data ?? []).forEach((s) => stateByErpId.set(Number(s.erp_order_id), s));
    const orderByErpId = new Map<number, NormalizedMapOrder>();
    normalizedOrders.forEach((n) => orderByErpId.set(n.erpOrderId, n));

    const deliveries: EnrichedOrder[] = normalizedOrders.map((n) => {
      const state = stateByErpId.get(n.erpOrderId) ?? null;
      return {
        order: n,
        key: `d:${n.key}`,
        erpId: n.erpOrderId,
        state,
        status: state?.operational_status ?? "pending",
        opType: "delivery",
      };
    });

    const pickups: EnrichedOrder[] = (pickupsQ.data ?? []).map((s) => {
      const erpId = Number(s.erp_order_id);
      const order = orderByErpId.get(erpId) ?? fallbackOrderFromState(s);
      return {
        order,
        key: `p:${s.id}`,
        erpId,
        state: s,
        status: s.operational_status,
        opType: "pickup",
        scheduledDate: s.pickup_scheduled_date,
      };
    });

    // 3) HISTÓRICO PERMANENTE: concluídos vindos do banco operacional.
    const history: EnrichedOrder[] = (completedQ.data ?? []).map((s) => {
      const erpId = Number(s.erp_order_id);
      const order = orderByErpId.get(erpId) ?? fallbackOrderFromState(s);
      const isPickupOp = s.pickup_completed_at != null;
      return {
        order,
        key: `${isPickupOp ? "p" : "d"}:hist-${s.id}`,
        erpId,
        state: s,
        status: s.operational_status,
        opType: isPickupOp ? "pickup" : "delivery",
        scheduledDate: s.pickup_scheduled_date,
      };
    });

    // Deduplicação: estado/pedido do dia tem prioridade sobre o histórico.
    return dedupeBy(
      [...deliveries, ...pickups, ...history],
      (e) => `${e.erpId}:${e.opType}`,
    );
  }, [normalizedOrders, statesQ.data, pickupsQ.data, completedQ.data]);

  // ── Auto-geocoding: dispara POST /api/v1/map/geocode para os pedidos
  // pending que ainda não foram tentados nesta sessão. Uma única vez por
  // conjunto. Falha não gera loop pois os IDs entram em `attemptedRef`
  // imediatamente. Nova tentativa: mudar de data ou usar o botão manual.
  useEffect(() => {
    if (ordersQ.isLoading || ordersQ.isFetching) return;
    if (!ordersQ.data?.ok) return;
    if (geocodeM.isPending) return;

    const pendingIds: number[] = [];
    for (const o of rawOrders) {
      const id = typeof o.orderId === "number" ? o.orderId : Number(o.orderId);
      if (!Number.isInteger(id) || id <= 0) continue;
      if (attemptedRef.current.has(id)) continue;
      const loc = o.location;
      if (!loc || loc.source !== "pending") continue;
      if (Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) continue;
      pendingIds.push(id);
    }
    if (pendingIds.length === 0) return;

    // Marca antes de disparar — protege contra re-render/refetch em loop.
    pendingIds.forEach((id) => attemptedRef.current.add(id));

    if (import.meta.env.DEV) {
      console.log("[map-geocoding] pending orders:", pendingIds.length);
      console.log("[map-geocoding] posting internal ids:", pendingIds);
    }

    geocodeM
      .mutateAsync({ orderIds: pendingIds })
      .then((res) => {
        if (import.meta.env.DEV) {
          console.log("[map-geocoding] completed:", res?.ok ? "ok" : "error", res?.status);
        }
        // Refetch para materializar as coordenadas.
        qc.invalidateQueries({ queryKey: ["erp", "map", "orders", date] });
      })
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.warn("[map-geocoding] failed:", (err as Error)?.message);
        }
        // IDs permanecem em attemptedRef para evitar loop; usuário pode
        // retentar manualmente pelo OrderDetailSheet.
      });
  }, [rawOrders, ordersQ.data, ordersQ.isLoading, ordersQ.isFetching, geocodeM, qc, date]);

  // Filtro por texto + status operacional
  const filtered: EnrichedOrder[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enrichedAll.filter((e) => {
      // Concluídos ficam ocultos por padrão — só aparecem no filtro explícito.
      const bucket = filterOfStatus(e.status);
      if (filter === "completed") {
        if (bucket !== "completed") return false;
        // Janela de exibição — nunca exclui registros, apenas oculta.
        if (completedScope === "window" && !isWithinCompletedWindow(e.state, mapWindow))
          return false;
      } else {
        if (bucket === "completed") return false;
        if (filter === "deliveries" && e.opType !== "delivery") return false;
        if (filter === "pickups" && e.opType !== "pickup") return false;
        if (filter === "customer_will_call" && bucket !== "customer_will_call") return false;
        // "all": remove duplicata delivery↔pickup do mesmo pedido — prioriza pickup.
        if (filter === "all" && e.opType === "delivery") {
          const hasPickupOnDate = (pickupsQ.data ?? []).some(
            (s) => Number(s.erp_order_id) === e.erpId,
          );
          if (hasPickupOnDate) return false;
        }
      }
      if (!q) return true;
      return (
        e.order.customerName.toLowerCase().includes(q) ||
        e.order.address.formatted.toLowerCase().includes(q) ||
        e.order.orderNumber.toLowerCase().includes(q)
      );
    });
  }, [enrichedAll, query, filter, pickupsQ.data, completedScope, mapWindow]);

  // Ordenação
  const orders: EnrichedOrder[] = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case "customer":
        arr.sort((a, b) => a.order.customerName.localeCompare(b.order.customerName));
        break;
      case "city":
        arr.sort((a, b) =>
          a.order.address.formatted.localeCompare(b.order.address.formatted),
        );
        break;
      case "status":
        arr.sort((a, b) => a.status.localeCompare(b.status));
        break;
      case "number":
        arr.sort((a, b) => a.erpId - b.erpId);
        break;
      case "manual":
      default:
        arr.sort((a, b) => {
          const sa = a.state?.sequence ?? Number.MAX_SAFE_INTEGER;
          const sb = b.state?.sequence ?? Number.MAX_SAFE_INTEGER;
          return sa - sb;
        });
    }
    return arr;
  }, [filtered, sort]);

  const markers: MapMarkerData[] = useMemo(() => {
    return orders
      // Marcadores dependem APENAS de coordenada válida. Lista/detalhe/ações
      // operacionais ignoram `location` — a fonte de verdade é `address`.
      .filter((e) => isMappable(e.order))
      .map((e) => {
        const overdue =
          e.opType === "pickup" &&
          e.scheduledDate != null &&
          e.scheduledDate < today();
        const color = overdue ? ATTENTION_RED : publicStatusColor(e.status);
        // Marcador de recolha usa o período (MANHÃ/TARDE) em vez do
        // horário da entrega — nunca mistura os dois.
        const timeOrPeriod =
          e.opType === "pickup"
            ? pickupPeriodAbbrev(e.state?.pickup_scheduled_time) ?? ""
            : resolveDeliveryTime(e.order);
        return {
          id: e.key,
          lat: e.order.location.latitude as number,
          lng: e.order.location.longitude as number,
          color,
          label: e.order.customerName,
          orderNumber: e.order.orderNumber,
          deliveryTime: timeOrPeriod,
        };
      });
  }, [orders]);

  // Contadores por bucket funcional (Pendente, Em entrega, ...).
  const filterCounts = useMemo(() => {
    const base: Partial<Record<OperationalFilter, number>> = {
      all: 0,
      deliveries: 0,
      pickups: 0,
      customer_will_call: 0,
      completed: 0,
    };
    enrichedAll.forEach((e) => {
      const bucket = filterOfStatus(e.status);
      if (bucket === "completed") base.completed = (base.completed ?? 0) + 1;
      else base.all = (base.all ?? 0) + 1;
      if (e.opType === "delivery" && bucket !== "completed") base.deliveries = (base.deliveries ?? 0) + 1;
      if (e.opType === "pickup" && bucket !== "completed") base.pickups = (base.pickups ?? 0) + 1;
      if (bucket === "customer_will_call") base.customer_will_call = (base.customer_will_call ?? 0) + 1;
    });
    return base;
  }, [enrichedAll]);

  const counters = useMemo(
    () => ({ ...filterCounts, total: enrichedAll.length }),
    [filterCounts, enrichedAll.length],
  );

  const profileById = useMemo(() => {
    const map = new Map<string, string>();
    (profilesQ.data ?? []).forEach((p) => map.set(p.id, p.full_name ?? "Sem nome"));
    return map;
  }, [profilesQ.data]);

  const selected = selectedKey ? orders.find((e) => e.key === selectedKey) : null;
  const preview = previewKey ? orders.find((e) => e.key === previewKey) : null;

  useEffect(() => {
    if (selected) {
      setDetailOpen(true);
      setOpenSeq((n) => n + 1);
    }
  }, [selected, selectedKey]);

  function handleCloseDetail() {
    setDetailOpen(false);
    setSelectedKey(null);
  }

  // Auto-selecionar próximo pendente após ação. Somente quando a operação
  // realmente terminou — do contrário mantém o pedido aberto para permitir
  // o passo seguinte (ex.: definir recolha após confirmar entrega).
  function selectNextPending(currentKey: string) {
    const pool = orders.filter(
      (e) => (e.status === "pending" || e.status === "in_progress") && e.key !== currentKey,
    );
    if (pool.length === 0) {
      setSelectedKey(null);
      setDetailOpen(false);
      return;
    }
    setSelectedKey(pool[0].key);
  }

  function handleAfterAction(newState: OperationState, currentKey: string) {
    const done =
      newState.operational_status === "delivered" ||
      newState.operational_status === "pickup_completed" ||
      newState.operational_status === "collected";
    if (done) selectNextPending(currentKey);
  }

  return (
    <div className="relative flex h-[calc(100vh-3.5rem)] w-full flex-col md:flex-row">
      <div className="hidden">Execute esta instrucao no projeto: Oi</div>
      <aside className="hidden w-96 shrink-0 flex-col border-r bg-surface md:flex">
        <div className="border-b p-4">
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8"
            />
            <Select value={company} onValueChange={(v) => setCompany(v as CompanyChoice)}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="1">Graal</SelectItem>
                <SelectItem value="3">Grott</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <OperationalFilters active={filter} counts={filterCounts} onChange={setFilter} />
          {filter === "completed" && (
            <CompletedScopeToggle
              scope={completedScope}
              onChange={setCompletedScope}
              window={mapWindow}
            />
          )}
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-7"
              placeholder="Buscar cliente, endereço ou nº"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <OperationalCounters counts={counters} className="mt-3" />
          <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px]">
            <div className="rounded-md bg-emerald-50 py-1 text-emerald-700">
              <div className="text-sm font-semibold tabular-nums">{geoSummary.mapped}</div>
              <div>Mapeados</div>
            </div>
            <div className="rounded-md bg-amber-50 py-1 text-amber-700">
              <div className="text-sm font-semibold tabular-nums">{geoSummary.pending}</div>
              <div>Loc. pendentes</div>
            </div>
            <div className="rounded-md bg-muted py-1 text-muted-foreground">
              <div className="text-sm font-semibold tabular-nums">{geoSummary.unresolved}</div>
              <div>Não local.</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Ordenar:</span>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-7 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Ordem manual</SelectItem>
                <SelectItem value="customer">Cliente</SelectItem>
                <SelectItem value="city">Endereço</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="number">Nº do pedido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!online && (
            <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
              <WifiOff className="h-3 w-3" /> Sem conexão — ações serão sincronizadas depois.
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          <OrdersList
            orders={orders}
              profileById={profileById}
            loading={ordersQ.isLoading || statesQ.isLoading}
            error={ordersQ.isError || Boolean(erpError)}
            errorMessage={erpError?.message}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
          />
        </div>
      </aside>

      <div className="relative flex-1">
        <div className="absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3 md:hidden">
          <div className="flex items-center gap-1 rounded-lg border bg-surface/95 p-2 shadow-sm backdrop-blur">
            <Calendar className="ml-1 h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
            <Select value={company} onValueChange={(v) => setCompany(v as CompanyChoice)}>
              <SelectTrigger className="h-8 w-24 border-0 bg-transparent shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="1">Graal</SelectItem>
                <SelectItem value="3">Grott</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-full border bg-surface/95 px-2 py-1.5 shadow-sm backdrop-blur">
            <OperationalFilters active={filter} counts={filterCounts} onChange={setFilter} />
            {filter === "completed" && (
              <CompletedScopeToggle
                scope={completedScope}
                onChange={setCompletedScope}
                window={mapWindow}
              />
            )}
          </div>
          {!online && (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 shadow-sm">
              <WifiOff className="h-3 w-3" /> Offline
            </div>
          )}
        </div>

        
        <div className="absolute right-3 bottom-24 z-10 md:bottom-4 md:right-16">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-full bg-surface/95 shadow-sm backdrop-blur"
                aria-label="Ver legenda"
                title="Ver legenda"
              >
                <Info className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="w-56 space-y-1.5 p-3 text-xs">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Legenda
              </div>
              <LegendRow color="#d99a22" label="Pendente" />
              <LegendRow color="#16a34a" label="Recolha agendada" />
              <LegendRow color="#f59e0b" label="Cliente irá avisar" />
              <LegendRow color="#6b7280" label="Concluído" />
              <LegendRow color="#dc2626" label="Atrasada" />
            </PopoverContent>
          </Popover>
        </div>

        {mobileView === "map" ? (
          <MapView
            markers={markers}
            onMarkerClick={(id) => {
              setPreviewKey(id);
            }}
            selectedId={previewKey ?? selectedKey}
          />
        ) : (
          <div className="h-full overflow-y-auto bg-background pt-32">
            <OrdersList
              orders={orders}
              profileById={profileById}
              loading={ordersQ.isLoading || statesQ.isLoading}
              error={ordersQ.isError || Boolean(erpError)}
              errorMessage={erpError?.message}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
            />
          </div>
        )}

        {preview && mobileView === "map" && (
          <MapPreviewCard
            entry={preview}
            profileById={profileById}
            onClose={() => setPreviewKey(null)}
            onOpenDetails={() => {
              setSelectedKey(preview.key);
              setPreviewKey(null);
            }}
          />
        )}

        {mobileView === "map" && markers.length === 0 && !ordersQ.isLoading && (
          <div className="pointer-events-none absolute inset-x-4 bottom-24 z-10 mx-auto max-w-md rounded-lg border bg-surface/95 p-3 text-center text-xs text-muted-foreground shadow-sm backdrop-blur md:bottom-4">
            {rawOrders.length === 0
              ? "Nenhum pedido encontrado para esta data."
              : `${rawOrders.length} pedido${rawOrders.length === 1 ? "" : "s"} sem coordenadas ainda. Aguardando localização — nenhum pino no mapa.`}
          </div>
        )}

        <div className="absolute right-3 top-32 z-10 flex flex-col gap-2 md:hidden">
          <Button
            size="icon"
            variant={mobileView === "map" ? "default" : "outline"}
            className="h-11 w-11 rounded-full shadow"
            onClick={() => setMobileView("map")}
            aria-label="Ver mapa"
          >
            <MapPin className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={mobileView === "list" ? "default" : "outline"}
            className="h-11 w-11 rounded-full shadow"
            onClick={() => setMobileView("list")}
            aria-label="Ver lista"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto md:ml-auto md:max-w-xl">
          {selected && (
            <OrderDetailSheet
              key={`${selected.key}-${openSeq}`}
              order={selected.order}
              state={selected.state}
              operationDate={date}
              companyId={companyId ?? null}
              onClose={handleCloseDetail}
              onAfterAction={(newState) => handleAfterAction(newState, selected.key)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}


function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function MapPreviewCard({
  entry,
  profileById,
  onClose,
  onOpenDetails,
}: {
  entry: EnrichedOrder;
  profileById: Map<string, string>;
  onClose: () => void;
  onOpenDetails: () => void;
}) {
  const o = entry.order;
  const isPickup = entry.opType === "pickup";
  const scheduled = entry.state?.pickup_scheduled_date ?? null;
  const overdue = isPickup && scheduled != null && scheduled < today();
  const color = overdue ? ATTENTION_RED : publicStatusColor(entry.status);
  const assigneeId = isPickup
    ? entry.state?.pickup_assignee_id
    : entry.state?.delivery_assignee_id;
  const assigneeName = assigneeId ? profileById.get(assigneeId) : null;
  const period = pickupPeriodAbbrev(entry.state?.pickup_scheduled_time);
  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-24 z-20 mx-auto max-w-md rounded-xl border bg-surface p-3 shadow-xl md:bottom-6 md:left-auto md:right-6 md:mx-0">
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>#{o.orderNumber}</span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: color }}
            >
              {overdue ? "Recolha atrasada" : publicStatusLabel(entry.status)}
            </span>
          </div>
          <div className="truncate text-sm font-semibold">{o.customerName}</div>
          {o.address.formatted && (
            <div className="line-clamp-2 text-xs text-muted-foreground">
              {o.address.formatted}
            </div>
          )}
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {isPickup ? (
              <>
                <div>
                  <span className="block text-[10px] uppercase">Recolha</span>
                  <span className="font-medium text-foreground">
                    {scheduled ? formatShortDate(scheduled) : "—"}
                    {period ? ` · ${period}` : ""}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase">Responsável</span>
                  <span className="font-medium text-foreground">
                    {assigneeName ?? "Sem responsável"}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="block text-[10px] uppercase">Entrega</span>
                  <span className="font-medium text-foreground">
                    {o.deliveryDate ? formatShortDate(o.deliveryDate) : "—"}
                    {o.deliveryTime ? ` · ${o.deliveryTime}` : ""}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase">Responsável</span>
                  <span className="font-medium text-foreground">
                    {assigneeName ?? "Sem responsável"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Button onClick={onOpenDetails} className="mt-3 h-10 w-full text-sm font-semibold">
        Ver detalhes
      </Button>
    </div>
  );
}

function formatShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function OrdersList({
  orders,
  profileById,
  loading,
  error,
  errorMessage,
  selectedKey,
  onSelect,
}: {
  orders: EnrichedOrder[];
  profileById?: Map<string, string>;
  loading: boolean;
  error: boolean;
  errorMessage?: string;
  selectedKey: string | null;
  onSelect: (id: string) => void;
}) {
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando pedidos…</div>;
  if (error) {
    return (
      <div className="p-6 text-sm text-destructive">
        {errorMessage || "Não foi possível consultar pedidos no ERP."}{" "}
        <Link to="/settings/erp" className="underline">
          Ver diagnóstico
        </Link>
        .
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Nenhum pedido para os filtros atuais.
      </div>
    );
  }
  return (
    <ul className="divide-y">
      {orders.map((e) => {
        const o = e.order;
        const active = selectedKey === e.key;
        const src = o.location.source;
        return (
          <li key={e.key}>
            <button
              type="button"
              onClick={() => onSelect(e.key)}
              className={cn(
                "flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                active && "bg-accent/40",
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: publicStatusColor(e.status) }}
                  />
                  <span className="truncate text-sm font-medium">{o.customerName}</span>
                  {o.malformed && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      dados incompletos
                    </span>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  #{o.orderNumber}
                </span>
              </div>
              {o.address.formatted && (
                <span className="line-clamp-2 text-xs text-muted-foreground">{o.address.formatted}</span>
              )}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium text-foreground">
                  {publicStatusLabel(e.status)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <User className="h-2.5 w-2.5" />
                  {(() => {
                    const id = e.state?.delivery_assignee_id;
                    const nm = id ? profileById?.get(id) : null;
                    return nm ?? <span className="italic">sem responsável</span>;
                  })()}
                </span>
                {e.state?.operational_date && e.state.operational_date !== e.state.operation_date && (
                  <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-sky-800">
                    reag. {e.state.operational_date}
                  </span>
                )}
                {o.period && <span>· {o.period}</span>}
                {src === "pending" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                    <Loader2 className="h-2.5 w-2.5" /> aguardando localização
                  </span>
                )}
                {src === "unresolved" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
                    <MapPinOff className="h-2.5 w-2.5" /> não localizado
                  </span>
                )}
                {src === "cache" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800">
                    <MapPin className="h-2.5 w-2.5" /> mapeado
                  </span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}