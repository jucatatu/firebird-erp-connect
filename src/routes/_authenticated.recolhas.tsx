import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMapOrders } from "@/hooks/use-erp";
import { useOperationStates, useProfiles } from "@/hooks/use-operations";
import {
  normalizeMapOrder,
  type MapOrder,
  type NormalizedMapOrder,
} from "@/lib/erp.functions";
import {
  publicStatusLabel,
  publicStatusColor,
  pickupPeriodLabel,
  type OperationState,
  type OperationalStatus,
} from "@/lib/operations/types";
import { OrderDetailSheet } from "@/components/operation/order-detail-sheet";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Calendar, User, Package, Phone, CalendarClock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/recolhas")({
  head: () => ({
    meta: [
      { title: "Recolhas pendentes — ERP" },
      { name: "description", content: "Fila de equipamentos aguardando recolhimento." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: RecolhasPage,
});

type CompanyChoice = "all" | "1" | "3";
type AssigneeFilter = "all" | "mine" | "none" | string;

const PICKUP_STATUSES = new Set<OperationalStatus>([
  "awaiting_pickup_definition",
  "awaiting_customer_contact",
  "customer_will_call",
  "pickup_scheduled",
  "pickup_in_progress",
]);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function RecolhasPage() {
  // "Recolhas" mostra estados operacionais pendentes — independentemente da
  // data ERP. Usamos a data como filtro do que consultar no ERP para as
  // linhas correspondentes (pedidos que já geraram estado local).
  const [date, setDate] = useState(today());
  const [company, setCompany] = useState<CompanyChoice>("all");
  const [assignee, setAssignee] = useState<AssigneeFilter>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openSeq, setOpenSeq] = useState(0);
  const companyId = company === "all" ? undefined : (Number(company) as 1 | 3);
  const { user } = useAuthSession();

  const ordersQ = useMapOrders({ date, companyId });
  const statesQ = useOperationStates(date, companyId ?? null);
  const profilesQ = useProfiles();

  const raw: MapOrder[] = ordersQ.data?.data?.orders ?? [];
  const normalized = useMemo(() => raw.map((o, i) => normalizeMapOrder(o, i)), [raw]);
  const orderByErp = useMemo(() => {
    const m = new Map<number, NormalizedMapOrder>();
    normalized.forEach((n) => m.set(n.erpOrderId, n));
    return m;
  }, [normalized]);

  const profileById = useMemo(() => {
    const m = new Map<string, string>();
    (profilesQ.data ?? []).forEach((p) => m.set(p.id, p.full_name ?? "Sem nome"));
    return m;
  }, [profilesQ.data]);

  const today0 = today();
  const list = useMemo(() => {
    return (statesQ.data ?? [])
      .filter((s) => PICKUP_STATUSES.has(s.operational_status))
      .filter((s) => {
        const aId = s.pickup_assignee_id ?? s.delivery_assignee_id ?? null;
        if (assignee === "all") return true;
        if (assignee === "none") return !aId;
        if (assignee === "mine") return !!user && aId === user.id;
        return aId === assignee;
      })
      .map((s) => {
        const order =
          orderByErp.get(Number(s.erp_order_id)) ??
          fallbackFromSnapshot(s);
        return { order, state: s, status: s.operational_status };
      })
      .sort((a, b) => {
        const da = a.state.pickup_scheduled_date ?? "9999-99-99";
        const db = b.state.pickup_scheduled_date ?? "9999-99-99";
        const overdueA = da < today0 ? 0 : da === today0 ? 1 : 2;
        const overdueB = db < today0 ? 0 : db === today0 ? 1 : 2;
        if (overdueA !== overdueB) return overdueA - overdueB;
        return da.localeCompare(db);
      });
  }, [statesQ.data, orderByErp, today0, assignee, user]);

  const assignees = useMemo(() => {
    const ids = new Set<string>();
    (statesQ.data ?? []).forEach((s) => {
      const id = s.pickup_assignee_id ?? s.delivery_assignee_id;
      if (id) ids.add(id);
    });
    return Array.from(ids).map((id) => ({ id, name: profileById.get(id) ?? "Usuário" }));
  }, [statesQ.data, profileById]);

  const selected = openKey ? list.find((e) => e.order.key === openKey) : null;

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col">
      <header className="border-b bg-surface p-3">
        <h1 className="text-base font-semibold">Recolhas</h1>
        <p className="text-xs text-muted-foreground">
          Equipamentos pendentes de recolhimento. Atrasadas primeiro.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8" />
          <Select value={company} onValueChange={(v) => setCompany(v as CompanyChoice)}>
            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="1">Graal</SelectItem>
              <SelectItem value="3">Grott</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assignee} onValueChange={(v) => setAssignee(v as AssigneeFilter)}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {user && <SelectItem value="mine">Meus pedidos</SelectItem>}
              <SelectItem value="none">Sem responsável</SelectItem>
              {assignees.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {statesQ.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma recolha pendente.
            <div className="mt-1">
              <Link to="/" className="text-xs underline">Voltar ao mapa</Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {list.map((e) => (
              <PickupItem
                key={e.order.key}
                order={e.order}
                state={e.state}
                status={e.status}
                selected={openKey === e.order.key}
                assigneeName={
                  e.state.pickup_assignee_id
                    ? profileById.get(e.state.pickup_assignee_id) ?? null
                    : null
                }
                today={today0}
                onOpen={() => {
                  setOpenKey(e.order.key);
                  setOpenSeq((n) => n + 1);
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setOpenKey(null)}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto md:ml-auto md:max-w-xl">
          {selected && (
            <OrderDetailSheet
              key={`${selected.order.key}-${openSeq}`}
              order={selected.order}
              state={selected.state}
              operationDate={date}
              companyId={companyId ?? null}
              onClose={() => setOpenKey(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Reconstrói um NormalizedMapOrder a partir do snapshot local quando o
 *  ERP não retorna a linha para a data (ex.: recolha ficou em outra data). */
function fallbackFromSnapshot(s: OperationState): NormalizedMapOrder {
  const snap = (s.snapshot ?? {}) as Record<string, any>;
  const deliveryAddress = snap.deliveryAddress || snap.payload?.deliveryAddress;
  
  const address = deliveryAddress?.formattedAddress || (typeof snap.address === "string" ? snap.address : "");
  
  return {
    key: `state-${s.id}`,
    erpOrderId: Number(s.erp_order_id),
    orderNumber: String(s.erp_order_number ?? s.erp_order_id),
    companyId: s.company_id,
    customerName: typeof snap.customerName === "string" ? snap.customerName : "(sem dados do ERP)",
    phone: typeof snap.phone === "string" ? snap.phone : null,
    address: {
      formatted: address,
      street: deliveryAddress?.street || address,
      number: deliveryAddress?.number || "",
      complement: deliveryAddress?.complement || "",
      district: deliveryAddress?.neighborhood || "",
      city: deliveryAddress?.city || "",
      state: deliveryAddress?.state || "",
    },
    location: {
      latitude: deliveryAddress?.latitude || null,
      longitude: deliveryAddress?.longitude || null,
      locationType: deliveryAddress?.latitude ? "rooftop" : "",
      precision: deliveryAddress?.latitude ? "exact" : "",
      placeId: deliveryAddress?.placeId || "",
      matchMismatch: false,
      source: deliveryAddress?.latitude ? "cache" : "unresolved",
      cacheKey: deliveryAddress?.placeId || "",
    },
    observations: null,
    erpStatus: null,
    deliveryDate: typeof snap.deliveryDate === "string" ? snap.deliveryDate : null,
    returnDate: null,
    period: typeof snap.period === "string" ? snap.period : null,
    deliveryTime: null,
    items: [],
    equipments: [],


    malformed: false,
    raw: {},
  };
}

function formatBrDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}`;
}

function PickupItem({
  order,
  state,
  status,
  selected,
  assigneeName,
  today,
  onOpen,
}: {
  order: NormalizedMapOrder;
  state: OperationState;
  status: OperationalStatus;
  selected: boolean;
  assigneeName: string | null;
  today: string;
  onOpen: () => void;
}) {
  const scheduled = state.pickup_scheduled_date;
  const overdue = scheduled != null && scheduled < today;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/40",
          selected && "bg-accent/40",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: publicStatusColor(status) }}
            />
            <span className="truncate font-medium">{order.customerName}</span>
            {overdue && (
              <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                Atrasada
              </span>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
            #{order.orderNumber}
          </span>
        </div>
        {order.address.formatted && (
          <div className="line-clamp-2 text-xs text-muted-foreground">{order.address.formatted}</div>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium text-foreground">
            {publicStatusLabel(status)}
          </span>
          {scheduled && (
            <span className={cn("inline-flex items-center gap-1", overdue && "text-red-700")}>
              <CalendarClock className="h-3 w-3" /> {formatBrDate(scheduled)}
              {pickupPeriodLabel(state.pickup_scheduled_time) &&
                ` — ${pickupPeriodLabel(state.pickup_scheduled_time)}`}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {assigneeName ?? <span className="italic">sem responsável</span>}
          </span>
          {order.phone && (
            <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {order.phone}</span>
          )}
          {order.equipments.length > 0 && (
            <span className="inline-flex items-center gap-1 text-violet-700">
              <Package className="h-3 w-3" /> {order.equipments.length} eq.
            </span>
          )}
        </div>
      </button>
    </li>
  );
}
