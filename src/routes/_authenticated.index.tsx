import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapView, type MapMarkerData } from "@/components/map-view";
import { MapFilterChips } from "@/components/map-filter-chips";
import { type MapLayerKey } from "@/lib/map-layers";
import { useListOrders } from "@/hooks/use-erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, List, MapPin, Search, Phone, ExternalLink, X } from "lucide-react";
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

interface OrderRow {
  orderId?: number | null;
  orderNumber?: number | null;
  customerName?: string | null;
  clientName?: string | null;
  address?: string | null;
  phone?: string | null;
  companyId?: number | null;
  deliveryDate?: string | null;
  period?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  items?: unknown[];
  equipment?: unknown[];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function MapHome() {
  const [date, setDate] = useState<string>(today());
  const [company, setCompany] = useState<CompanyChoice>("all");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Set<MapLayerKey>>(() => new Set<MapLayerKey>(["pedidos"]));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [detailOpen, setDetailOpen] = useState(false);

  const companies = (company === "all" ? [1, 3] : [Number(company)]) as (1 | 3)[];
  const ordersQ = useListOrders(active.has("pedidos") ? { date, companies } : null);

  const rawOrders: OrderRow[] = useMemo(() => {
    const data = ordersQ.data as { data?: unknown } | undefined;
    if (!data) return [];
    const d = data.data as unknown;
    if (Array.isArray(d)) return d as OrderRow[];
    if (d && typeof d === "object" && Array.isArray((d as { orders?: unknown[] }).orders)) {
      return (d as { orders: OrderRow[] }).orders;
    }
    return [];
  }, [ordersQ.data]);

  const orders = useMemo(() => {
    if (!query.trim()) return rawOrders;
    const q = query.trim().toLowerCase();
    return rawOrders.filter((o) => {
      const name = (o.customerName || o.clientName || "").toLowerCase();
      const addr = (o.address || "").toLowerCase();
      const num = String(o.orderNumber ?? o.orderId ?? "");
      return name.includes(q) || addr.includes(q) || num.includes(q);
    });
  }, [rawOrders, query]);

  const markers: MapMarkerData[] = useMemo(() => {
    if (!active.has("pedidos")) return [];
    const raw = typeof window !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--map-pedido").trim()
      : "";
    const fill = raw ? `oklch(${raw})` : "#ea6a2a";
    return orders
      .filter((o) => typeof o.latitude === "number" && typeof o.longitude === "number")
      .map((o, idx) => ({
        id: String(o.orderId ?? o.orderNumber ?? idx),
        lat: o.latitude as number,
        lng: o.longitude as number,
        color: fill,
        label: o.customerName || o.clientName || "Pedido",
      }));
  }, [orders, active]);

  const counts: Partial<Record<MapLayerKey, number>> = {
    pedidos: active.has("pedidos") ? orders.length : 0,
    higienizacao: 0,
    entregues: 0,
    liberados: 0,
    recolhidos: 0,
    avisar: 0,
  };

  const selected = selectedId
    ? orders.find((o, i) => String(o.orderId ?? o.orderNumber ?? i) === selectedId)
    : null;

  useEffect(() => {
    if (selected) setDetailOpen(true);
  }, [selected]);

  const toggleLayer = (k: MapLayerKey) =>
    setActive((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

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
          <MapFilterChips active={active} counts={counts} onToggle={toggleLayer} />
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-7"
              placeholder="Buscar cliente, endereço ou nº"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <OrdersList
            orders={orders}
            loading={ordersQ.isLoading}
            error={ordersQ.isError}
            selectedId={selectedId}
            onSelect={setSelectedId}
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
            <MapFilterChips active={active} counts={counts} onToggle={toggleLayer} />
          </div>
        </div>

        {mobileView === "map" ? (
          <MapView markers={markers} onMarkerClick={setSelectedId} selectedId={selectedId} />
        ) : (
          <div className="h-full overflow-y-auto bg-background pt-32">
            <OrdersList
              orders={orders}
              loading={ordersQ.isLoading}
              error={ordersQ.isError}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        )}

        {mobileView === "map" && markers.length === 0 && !ordersQ.isLoading && (
          <div className="pointer-events-none absolute inset-x-4 bottom-24 z-10 mx-auto max-w-md rounded-lg border bg-surface/95 p-3 text-center text-xs text-muted-foreground shadow-sm backdrop-blur md:bottom-4">
            {active.has("pedidos")
              ? "Nenhum pedido com coordenadas para esta data. Assim que o ERP retornar lat/lng, os pinos aparecem aqui."
              : "Ative uma camada para ver marcadores no mapa."}
          </div>
        )}

        <div className="absolute right-3 top-32 z-10 flex flex-col gap-2 md:hidden">
          <Button
            size="icon"
            variant={mobileView === "map" ? "default" : "outline"}
            className="h-10 w-10 rounded-full shadow"
            onClick={() => setMobileView("map")}
            aria-label="Ver mapa"
          >
            <MapPin className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={mobileView === "list" ? "default" : "outline"}
            className="h-10 w-10 rounded-full shadow"
            onClick={() => setMobileView("list")}
            aria-label="Ver lista"
          >
            <List className="h-4 w-4" />
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="h-10 w-10 rounded-full shadow"
                aria-label="Buscar"
              >
                <Search className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh]">
              <SheetHeader>
                <SheetTitle>Buscar</SheetTitle>
              </SheetHeader>
              <Input
                className="mt-3"
                placeholder="Cliente, endereço ou nº"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="mt-3 h-[calc(70vh-8rem)] overflow-y-auto">
                <OrdersList
                  orders={orders}
                  loading={ordersQ.isLoading}
                  error={ordersQ.isError}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto md:ml-auto md:max-w-xl">
          {selected && <OrderDetail order={selected} onClose={() => setDetailOpen(false)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function OrdersList({
  orders,
  loading,
  error,
  selectedId,
  onSelect,
}: {
  orders: OrderRow[];
  loading: boolean;
  error: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando pedidos…</div>;
  if (error) {
    return (
      <div className="p-6 text-sm text-destructive">
        Não foi possível consultar pedidos no ERP.{" "}
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
        Nenhum pedido encontrado para esta data.
      </div>
    );
  }
  return (
    <ul className="divide-y">
      {orders.map((o, idx) => {
        const id = String(o.orderId ?? o.orderNumber ?? idx);
        const name = o.customerName || o.clientName || "(sem cliente)";
        const active = selectedId === id;
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSelect(id)}
              className={cn(
                "flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                active && "bg-accent/40",
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{name}</span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  #{o.orderNumber ?? o.orderId ?? "—"}
                </span>
              </div>
              {o.address && (
                <span className="line-clamp-2 text-xs text-muted-foreground">{o.address}</span>
              )}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {o.period && <span>{o.period}</span>}
                {o.phone && <span>· {o.phone}</span>}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function OrderDetail({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  const name = order.customerName || order.clientName || "(sem cliente)";
  const mapsUrl = order.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`
    : null;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Pedido #{order.orderNumber ?? order.orderId ?? "—"}
          </div>
          <h2 className="truncate text-lg font-semibold">{name}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {order.address && (
        <div className="rounded-md border p-3 text-sm">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Endereço</div>
          <div>{order.address}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        {order.phone && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Telefone</div>
            <div>{order.phone}</div>
          </div>
        )}
        {order.period && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Período</div>
            <div>{order.period}</div>
          </div>
        )}
        {order.deliveryDate && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Entrega</div>
            <div>{order.deliveryDate}</div>
          </div>
        )}
        {order.companyId != null && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Empresa</div>
            <div>{order.companyId === 3 ? "Grott" : order.companyId === 1 ? "Graal" : String(order.companyId)}</div>
          </div>
        )}
      </div>

      {Array.isArray(order.items) && order.items.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium">Itens</div>
          <ul className="divide-y rounded-md border text-sm">
            {order.items.slice(0, 20).map((it, i) => (
              <li key={i} className="px-3 py-2">
                {typeof it === "object" && it && "description" in it
                  ? String((it as { description: unknown }).description)
                  : JSON.stringify(it)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(order.equipment) && order.equipment.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium">Equipamentos</div>
          <ul className="divide-y rounded-md border text-sm">
            {order.equipment.slice(0, 20).map((it, i) => (
              <li key={i} className="px-3 py-2">
                {typeof it === "object" && it && "description" in it
                  ? String((it as { description: unknown }).description)
                  : JSON.stringify(it)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {order.notes && (
        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          {order.notes}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {mapsUrl && (
          <Button asChild size="sm" variant="outline">
            <a href={mapsUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Google Maps
            </a>
          </Button>
        )}
        {order.phone && (
          <Button asChild size="sm" variant="outline">
            <a href={`tel:${order.phone}`}>
              <Phone className="mr-2 h-4 w-4" /> Ligar
            </a>
          </Button>
        )}
        <span className="text-[10px] text-muted-foreground">
          Ações operacionais (Entregar / Recolha / Cliente irá avisar) serão liberadas quando o
          backend correspondente estiver disponível.
        </span>
      </div>
    </div>
  );
}