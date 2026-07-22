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
import { useOperationStates } from "@/hooks/use-operations";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { isMappable, normalizeMapOrder, type MapOrder, type NormalizedMapOrder } from "@/lib/erp.functions";
import { resolveDeliveryTime } from "@/lib/delivery-time";
import {
  OPERATIONAL_STATUS_COLOR,
  OPERATIONAL_STATUS_LABEL,
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
import { Calendar, List, MapPin, Search, MapPinOff, Loader2, WifiOff } from "lucide-react";
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
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function MapHome() {
  const [date, setDate] = useState<string>(today());
  const [company, setCompany] = useState<CompanyChoice>("all");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OperationalFilter>("all");
  const [sort, setSort] = useState<SortKey>("manual");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [detailOpen, setDetailOpen] = useState(false);

  const online = useNetworkStatus();
  const companyId = company === "all" ? undefined : (Number(company) as 1 | 3);

  const ordersQ = useMapOrders({ date, companyId });
  const statesQ = useOperationStates(date, companyId ?? null);
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

  // Junta pedidos do ERP com estados operacionais locais por erp_order_id.
  const enrichedAll: EnrichedOrder[] = useMemo(() => {
    const stateByErpId = new Map<number, OperationState>();
    (statesQ.data ?? []).forEach((s) => stateByErpId.set(Number(s.erp_order_id), s));
    return normalizedOrders.map((n) => {
      const state = stateByErpId.get(n.erpOrderId) ?? null;
      return {
        order: n,
        key: n.key,
        erpId: n.erpOrderId,
        state,
        status: state?.operational_status ?? "pending",
      };
    });
  }, [normalizedOrders, statesQ.data]);

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
      if (filter !== "all" && e.status !== filter) return false;
      if (!q) return true;
      return (
        e.order.customerName.toLowerCase().includes(q) ||
        e.order.address.formatted.toLowerCase().includes(q) ||
        e.order.orderNumber.toLowerCase().includes(q)
      );
    });
  }, [enrichedAll, query, filter]);

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
      .map((e) => ({
        id: e.key,
        lat: e.order.location.latitude as number,
        lng: e.order.location.longitude as number,
        color: OPERATIONAL_STATUS_COLOR[e.status],
        label: e.order.customerName,
        orderNumber: e.order.orderNumber,
        // Prioriza o novo campo `deliveryTime` (backend v1.4.2+); cai
        // para a parte de hora de expectedDelivery/deliveryDate. Nunca
        // usa `period`, nunca inventa "Sem horário" no mapa.
        deliveryTime: resolveDeliveryTime(e.order),
      }));
  }, [orders]);

  // Contadores
  const counters = useMemo(() => {
    const base: Record<OperationalStatus, number> = {
      pending: 0,
      in_progress: 0,
      delivered: 0,
      collected: 0,
      customer_will_call: 0,
      not_found: 0,
      rescheduled: 0,
    };
    enrichedAll.forEach((e) => {
      base[e.status] += 1;
    });
    return { ...base, total: enrichedAll.length };
  }, [enrichedAll]);

  const filterCounts: Record<OperationalFilter, number> = useMemo(
    () => ({
      all: enrichedAll.length,
      pending: counters.pending,
      in_progress: counters.in_progress,
      delivered: counters.delivered,
      collected: counters.collected,
      customer_will_call: counters.customer_will_call,
      not_found: counters.not_found,
      rescheduled: counters.rescheduled,
    }),
    [enrichedAll.length, counters],
  );

  const selected = selectedKey ? orders.find((e) => e.key === selectedKey) : null;

  useEffect(() => {
    if (selected) setDetailOpen(true);
  }, [selected]);

  // Auto-selecionar próximo pendente após ação
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

  return (
    <div className="relative flex h-[calc(100vh-3.5rem)] w-full flex-col md:flex-row">
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
          </div>
          {!online && (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 shadow-sm">
              <WifiOff className="h-3 w-3" /> Offline
            </div>
          )}
        </div>

        {mobileView === "map" ? (
          <MapView markers={markers} onMarkerClick={setSelectedKey} selectedId={selectedKey} />
        ) : (
          <div className="h-full overflow-y-auto bg-background pt-32">
            <OrdersList
              orders={orders}
              loading={ordersQ.isLoading || statesQ.isLoading}
              error={ordersQ.isError || Boolean(erpError)}
              errorMessage={erpError?.message}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
            />
          </div>
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
              order={selected.order}
              state={selected.state}
              operationDate={date}
              companyId={companyId ?? null}
              onClose={() => setDetailOpen(false)}
              onAfterAction={() => selectNextPending(selected.key)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function OrdersList({
  orders,
  loading,
  error,
  errorMessage,
  selectedKey,
  onSelect,
}: {
  orders: EnrichedOrder[];
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
                    style={{ backgroundColor: OPERATIONAL_STATUS_COLOR[e.status] }}
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
                  {OPERATIONAL_STATUS_LABEL[e.status]}
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