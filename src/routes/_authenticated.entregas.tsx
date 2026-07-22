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
  OPERATIONAL_STATUS_COLOR,
  OPERATIONAL_STATUS_LABEL,
  type OperationState,
  type OperationalStatus,
} from "@/lib/operations/types";
import { filterOfStatus } from "@/components/operation/operational-filters";
import { OrderDetailSheet } from "@/components/operation/order-detail-sheet";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Calendar, User, Package, Phone } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/entregas")({
  head: () => ({
    meta: [
      { title: "Entregas do dia — ERP" },
      { name: "description", content: "Fila de entregas pendentes e em andamento." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: EntregasPage,
});

type CompanyChoice = "all" | "1" | "3";

const DELIVERY_STATUSES = new Set<OperationalStatus>([
  "pending",
  "in_progress",
  "rescheduled",
  "not_found",
]);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function EntregasPage() {
  const [date, setDate] = useState(today());
  const [company, setCompany] = useState<CompanyChoice>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openSeq, setOpenSeq] = useState(0);
  const companyId = company === "all" ? undefined : (Number(company) as 1 | 3);

  const ordersQ = useMapOrders({ date, companyId });
  const statesQ = useOperationStates(date, companyId ?? null);
  const profilesQ = useProfiles();

  const raw: MapOrder[] = ordersQ.data?.data?.orders ?? [];
  const normalized = useMemo(() => raw.map((o, i) => normalizeMapOrder(o, i)), [raw]);

  const stateByErp = useMemo(() => {
    const m = new Map<number, OperationState>();
    (statesQ.data ?? []).forEach((s) => m.set(Number(s.erp_order_id), s));
    return m;
  }, [statesQ.data]);

  const profileById = useMemo(() => {
    const m = new Map<string, string>();
    (profilesQ.data ?? []).forEach((p) => m.set(p.id, p.full_name ?? "Sem nome"));
    return m;
  }, [profilesQ.data]);

  const list = useMemo(() => {
    return normalized
      .map((n) => {
        const state = stateByErp.get(n.erpOrderId) ?? null;
        const status = state?.operational_status ?? "pending";
        return { order: n, state, status };
      })
      .filter((e) => DELIVERY_STATUSES.has(e.status))
      .sort((a, b) => {
        const rank = (s: OperationalStatus) =>
          s === "in_progress" ? 0 : s === "pending" ? 1 : s === "rescheduled" ? 2 : 3;
        return rank(a.status) - rank(b.status);
      });
  }, [normalized, stateByErp]);

  const selected = openKey ? list.find((e) => e.order.key === openKey) : null;

  function open(key: string) {
    setOpenKey(key);
    setOpenSeq((n) => n + 1);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col">
      <header className="border-b bg-surface p-3">
        <h1 className="text-base font-semibold">Entregas</h1>
        <p className="text-xs text-muted-foreground">O que ainda precisa ser entregue hoje.</p>
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
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {ordersQ.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma entrega pendente para {date}.
            <div className="mt-1">
              <Link to="/" className="text-xs underline">Voltar ao mapa</Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {list.map((e) => (
              <DeliveryItem
                key={e.order.key}
                order={e.order}
                state={e.state}
                status={e.status}
                selected={openKey === e.order.key}
                assigneeName={
                  e.state?.delivery_assignee_id
                    ? profileById.get(e.state.delivery_assignee_id) ?? null
                    : null
                }
                onOpen={() => open(e.order.key)}
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

function DeliveryItem({
  order,
  state,
  status,
  selected,
  assigneeName,
  onOpen,
}: {
  order: NormalizedMapOrder;
  state: OperationState | null;
  status: OperationalStatus;
  selected: boolean;
  assigneeName: string | null;
  onOpen: () => void;
}) {
  void state;
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
              style={{ backgroundColor: OPERATIONAL_STATUS_COLOR[status] }}
            />
            <span className="truncate font-medium">{order.customerName}</span>
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
            {OPERATIONAL_STATUS_LABEL[status]}
          </span>
          {order.deliveryTime && <span>· {order.deliveryTime}</span>}
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {assigneeName ?? <span className="italic">sem responsável</span>}
          </span>
          {order.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> {order.phone}
            </span>
          )}
          {order.equipments.length > 0 && (
            <span className="inline-flex items-center gap-1 text-violet-700">
              <Package className="h-3 w-3" /> chopeira
            </span>
          )}
        </div>
      </button>
    </li>
  );
}
