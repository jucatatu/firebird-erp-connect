import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ExternalLink,
  Phone,
  Play,
  CheckCircle2,
  Bell,
  MapPinOff,
  CalendarClock,
  StickyNote,
  Loader2,
  MapPin,
  UserPlus,
  Truck,
  PackageX,
  ChevronDown,
  Package,
  MoreHorizontal,
} from "lucide-react";
import type {
  NormalizedEquipment,
  NormalizedItem,
  NormalizedMapOrder,
} from "@/lib/erp.functions";
import {
  OperationConflictError,
  publicStatusLabel,
  pickupPeriodLabel,
  type OperationState,
  type OperationalStatus,
} from "@/lib/operations/types";
import {
  ACTION_LABEL,
  getAllowedOperationalActions,
  type OperationAction,
} from "@/lib/operations/state-machine";
import { hasReturnableEquipment } from "@/lib/operations/equipment";
import {
  useOperationEvents,
  useOperationMutations,
  useOperationNotes,
  useProfiles,
} from "@/hooks/use-operations";
import { useAuthSession } from "@/hooks/use-auth";
import { useGeocodeOrders } from "@/hooks/use-erp";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OperationTimeline } from "./operation-timeline";
import { cn } from "@/lib/utils";

const ACTION_ICON: Partial<Record<OperationAction, typeof Play>> = {
  start_delivery: Play,
  confirm_delivery: CheckCircle2,
  delivery_not_found: MapPinOff,
  reschedule_delivery: CalendarClock,
  customer_will_contact: Bell,
  schedule_pickup: CalendarClock,
  start_pickup: Truck,
  confirm_pickup: PackageX,
  pickup_not_found: MapPinOff,
};

// Ações que precisam de modal antes de aplicar
const ACTIONS_WITH_DIALOG = new Set<OperationAction>([
  "reschedule_delivery",
  "schedule_pickup",
  "confirm_pickup",
]);

/** Primary CTA — a "próxima ação natural" do fluxo. */
function primaryOf(actions: OperationAction[]): OperationAction | null {
  const priority: OperationAction[] = [
    "start_delivery",
    "confirm_delivery",
    "start_pickup",
    "confirm_pickup",
    "schedule_pickup",
  ];
  for (const p of priority) if (actions.includes(p)) return p;
  return actions[0] ?? null;
}

export function OrderDetailSheet({
  order,
  state,
  operationDate,
  companyId,
  onClose,
  onAfterAction,
}: {
  order: NormalizedMapOrder;
  state: OperationState | null;
  operationDate: string;
  companyId?: number | null;
  onClose: () => void;
  onAfterAction?: (state: OperationState) => void;
}) {
  const name = order.customerName;
  const orderNumber = order.orderNumber;
  const erpId = order.erpOrderId;
  const addressText = order.address.formatted;
  const mapsUrl = addressText
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`
    : null;

  const events = useOperationEvents(state?.id);
  const notes = useOperationNotes(state?.id);
  const profilesQ = useProfiles();
  const { user } = useAuthSession();

  const onConflict = () => {
    toast.error("Este pedido foi alterado por outro usuário", {
      description: "Os dados serão atualizados automaticamente.",
    });
  };
  const { ensure, transition, assignOperator, addNote } = useOperationMutations(
    operationDate,
    companyId,
    onConflict,
  );
  const geocodeM = useGeocodeOrders();
  const qc = useQueryClient();

  const currentStatus: OperationalStatus = state?.operational_status ?? "pending";
  const hasReturnable =
    state?.has_returnable_equipment ?? hasReturnableEquipment(order);

  const allowedActions = useMemo(
    () => getAllowedOperationalActions({ status: currentStatus, hasReturnableEquipment: hasReturnable }),
    [currentStatus, hasReturnable],
  );
  const primary = primaryOf(allowedActions);
  const secondary = allowedActions.filter((a) => a !== primary);

  const profileById = useMemo(() => {
    const map = new Map<string, string>();
    (profilesQ.data ?? []).forEach((p) => map.set(p.id, p.full_name ?? "Sem nome"));
    return map;
  }, [profilesQ.data]);
  const nameOf = (id: string | null | undefined) =>
    id ? profileById.get(id) ?? "Usuário" : null;

  const locSource = order.location?.source;
  const hasCoords =
    Number.isFinite(order.location?.latitude) &&
    Number.isFinite(order.location?.longitude);
  const canRetryGeocode =
    !hasCoords &&
    Boolean(addressText) &&
    erpId > 0 &&
    (locSource === "pending" || locSource === "unresolved");

  async function retryGeocode() {
    try {
      const res = await geocodeM.mutateAsync({ orderIds: [erpId] });
      if (!res?.ok) {
        toast.error("Não foi possível localizar o endereço", {
          description: res?.error?.message ?? undefined,
        });
        return;
      }
      await qc.invalidateQueries({ queryKey: ["erp", "map", "orders", operationDate] });
      toast.success("Localização atualizada");
    } catch (err) {
      toast.error("Falha ao atualizar localização", {
        description: (err as Error)?.message ?? String(err),
      });
    }
  }

  // Diálogos
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState(operationDate);
  const [reason, setReason] = useState("");
  const [pickupOpen, setPickupOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState(operationDate);
  const [pickupPeriod, setPickupPeriod] = useState<"manha" | "tarde" | "dia_todo">("manha");
  const [pickupNote, setPickupNote] = useState("");
  const [pickupAssignee, setPickupAssignee] = useState<string>("");
  // Modal de definição pós-entrega para chopeira
  const [defineOpen, setDefineOpen] = useState(false);
  // Modal de confirmação de recolhimento com equipamentos
  const [confirmPickupOpen, setConfirmPickupOpen] = useState(false);
  const [returnedIdx, setReturnedIdx] = useState<Set<number>>(
    () => new Set(order.equipments.map((_, i) => i)),
  );
  // Colapsáveis
  const [notesOpen, setNotesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [equipsOpen, setEquipsOpen] = useState(true);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [note, setNote] = useState("");

  async function ensureStateId(): Promise<string> {
    if (state) return state.id;
    const created = await ensure.mutateAsync({
      erpOrderId: erpId,
      erpOrderNumber: Number(order.orderNumber) || null,
      companyId: order.companyId,
      operationDate,
      customerName: order.customerName,
      address: addressText || null,
      phone: order.phone,
      hasReturnableEquipment: hasReturnableEquipment(order),
    });
    return created.id;
  }

  const busy =
    ensure.isPending ||
    transition.isPending ||
    assignOperator.isPending ||
    addNote.isPending;

  async function performTransition(
    action: OperationAction,
    payload?: Record<string, unknown>,
  ) {
    try {
      const id = await ensureStateId();
      const res = await transition.mutateAsync({
        stateId: id,
        action,
        expectedVersion: state?.version ?? 1,
        payload,
      });
      onAfterAction?.(res);
      return res;
    } catch (err) {
      if (!(err instanceof OperationConflictError)) {
        toast.error("Não foi possível aplicar a ação", {
          description: (err as Error)?.message ?? String(err),
        });
      }
      return null;
    }
  }

  // Após confirmar entrega em pedido com equipamento retornável, o
  // banco leva ao status `awaiting_pickup_definition`. Nesse instante
  // abrimos automaticamente o modal de definição (avisar ou agendar).
  useEffect(() => {
    if (currentStatus === "awaiting_pickup_definition") {
      setDefineOpen(true);
    }
  }, [currentStatus]);

  async function handleAction(action: OperationAction) {
    if (action === "reschedule_delivery") {
      setRescheduleOpen(true);
      return;
    }
    if (action === "schedule_pickup") {
      setPickupOpen(true);
      return;
    }
    if (action === "confirm_pickup") {
      setReturnedIdx(new Set(order.equipments.map((_, i) => i)));
      setConfirmPickupOpen(true);
      return;
    }
    await performTransition(action);
  }

  async function performReschedule() {
    if (!reason.trim()) return;
    await performTransition("reschedule_delivery", {
      newDate,
      reason: reason.trim(),
    });
    setRescheduleOpen(false);
    setReason("");
  }

  async function performSchedulePickup() {
    if (!pickupDate) return;
    // Persiste o período no campo estruturado `pickup_scheduled_time`
    // (coluna text existente) enviando-o como `scheduledTime`. O RPC
    // atual grava esse valor em pickup_scheduled_time diretamente — sem
    // migração e sem misturar com o pickup_note (que é observação livre).
    const res = await performTransition("schedule_pickup", {
      scheduledDate: pickupDate,
      scheduledTime: pickupPeriod,
      period: pickupPeriod,
      note: pickupNote || null,
    });
    setPickupOpen(false);
    setDefineOpen(false);
    setPickupNote("");
    setPickupPeriod("manha");
    // Atribuir responsável opcional pelo mesmo fluxo
    if (res && pickupAssignee) {
      try {
        await assignOperator.mutateAsync({
          stateId: res.id,
          role: "pickup",
          userId: pickupAssignee,
          expectedVersion: res.version,
        });
      } catch (err) {
        if (!(err instanceof OperationConflictError)) {
          toast.error("Não foi possível atribuir responsável", {
            description: (err as Error)?.message ?? String(err),
          });
        }
      }
      setPickupAssignee("");
    }
  }

  async function performConfirmPickup() {
    const returned = order.equipments
      .map((e, i) => ({ e, i }))
      .filter(({ i }) => returnedIdx.has(i))
      .map(({ e }) => ({ type: e.type, quantity: e.quantity, typeId: e.typeId }));
    await performTransition("confirm_pickup", {
      returnedEquipments: returned,
      partial: returned.length !== order.equipments.length,
    });
    setConfirmPickupOpen(false);
  }

  async function submitNote() {
    if (!note.trim()) return;
    const id = await ensureStateId();
    await addNote.mutateAsync({ stateId: id, body: note.trim() });
    setNote("");
  }

  async function assignMe(role: "delivery" | "pickup") {
    if (!user) return;
    try {
      const id = await ensureStateId();
      const res = await assignOperator.mutateAsync({
        stateId: id,
        role,
        userId: user.id,
        expectedVersion: state?.version ?? 1,
      });
      onAfterAction?.(res);
    } catch (err) {
      if (!(err instanceof OperationConflictError)) {
        toast.error("Não foi possível atribuir", {
          description: (err as Error)?.message ?? String(err),
        });
      }
    }
  }

  async function assignTo(role: "delivery" | "pickup", userId: string) {
    if (!userId) return;
    try {
      const id = await ensureStateId();
      const res = await assignOperator.mutateAsync({
        stateId: id,
        role,
        userId,
        expectedVersion: state?.version ?? 1,
      });
      onAfterAction?.(res);
    } catch (err) {
      if (!(err instanceof OperationConflictError)) {
        toast.error("Não foi possível atribuir", {
          description: (err as Error)?.message ?? String(err),
        });
      }
    }
  }

  const deliveryAssigneeId = state?.delivery_assignee_id ?? null;
  const pickupAssigneeId = state?.pickup_assignee_id ?? null;

  return (
    <div className="space-y-4 pb-4">
      {/* Header enxuto: cliente + ações rápidas */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>Pedido #{orderNumber}</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
              {publicStatusLabel(currentStatus)}
            </span>
            {hasReturnable && (
              <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">
                Chopeira
              </span>
            )}
          </div>
          <h2 className="truncate text-lg font-semibold leading-snug">{name}</h2>
          {order.deliveryTime && (
            <div className="text-xs text-muted-foreground">Horário previsto: {order.deliveryTime}</div>
          )}
        </div>
      </div>

      {/* Endereço + botões rápidos */}
      {addressText && (
        <div className="rounded-lg border bg-surface p-3 text-sm">
          <div className="mb-2">{addressText}</div>
          <div className="flex flex-wrap gap-2">
            {mapsUrl && (
              <Button asChild size="sm" variant="outline">
                <a href={mapsUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Rota
                </a>
              </Button>
            )}
            {order.phone && (
              <Button asChild size="sm" variant="outline">
                <a href={`tel:${order.phone}`}>
                  <Phone className="mr-1.5 h-3.5 w-3.5" /> {order.phone}
                </a>
              </Button>
            )}
            {canRetryGeocode && (
              <Button size="sm" variant="outline" onClick={retryGeocode} disabled={geocodeM.isPending}>
                {geocodeM.isPending ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Localizando…</>
                ) : (
                  <><MapPin className="mr-1.5 h-3.5 w-3.5" /> Localizar</>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Atribuição compacta */}
      <div className="space-y-1.5 rounded-lg border bg-surface p-3 text-sm">
        <AssignRow
          label="Entrega"
          currentName={nameOf(deliveryAssigneeId)}
          profiles={profilesQ.data ?? []}
          disabled={busy}
          isMe={!!user && deliveryAssigneeId === user.id}
          onPick={(uid) => assignTo("delivery", uid)}
          onAssignMe={user ? () => assignMe("delivery") : undefined}
        />
        {hasReturnable && (
          <AssignRow
            label="Recolha"
            currentName={nameOf(pickupAssigneeId)}
            profiles={profilesQ.data ?? []}
            disabled={busy}
            isMe={!!user && pickupAssigneeId === user.id}
            onPick={(uid) => assignTo("pickup", uid)}
            onAssignMe={user ? () => assignMe("pickup") : undefined}
          />
        )}
        {state?.pickup_scheduled_date && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700">
            <CalendarClock className="h-3.5 w-3.5" />
            Recolha agendada:{" "}
            {formatBrDate(state.pickup_scheduled_date)}
            {pickupPeriodLabel(state.pickup_scheduled_time) &&
              ` — ${pickupPeriodLabel(state.pickup_scheduled_time)}`}
            {state.pickup_note ? ` · ${state.pickup_note}` : ""}
          </div>
        )}
      </div>

      {/* Equipamentos (aberto por padrão quando há) e itens */}
      {order.equipments.length > 0 && (
        <SectionCollapsible
          open={equipsOpen}
          onOpenChange={setEquipsOpen}
          icon={Package}
          title={`Equipamentos (${order.equipments.length})`}
        >
          <EquipmentList items={order.equipments} />
        </SectionCollapsible>
      )}
      {order.items.length > 0 && (
        <SectionCollapsible
          open={itemsOpen}
          onOpenChange={setItemsOpen}
          icon={Package}
          title={`Itens (${order.items.length})`}
        >
          <ItemList items={order.items} />
        </SectionCollapsible>
      )}

      {/* Ação principal — 1 toque */}
      {primary && (
        <PrimaryCTA
          action={primary}
          onClick={() => handleAction(primary)}
          disabled={busy}
        />
      )}

      {/* Ações secundárias — colapsadas */}
      {secondary.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-center text-muted-foreground">
              <MoreHorizontal className="mr-1.5 h-3.5 w-3.5" /> Mais ações
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {secondary.map((action) => {
                const Icon = ACTION_ICON[action] ?? Play;
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => handleAction(action)}
                    disabled={busy}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-md border bg-surface px-3 py-2 text-xs font-medium transition-colors hover:bg-muted/40 disabled:opacity-50"
                  >
                    <Icon className="h-3.5 w-3.5" /> {ACTION_LABEL[action]}
                  </button>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {allowedActions.length === 0 && (
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
          Operação finalizada.
        </div>
      )}

      {order.observations && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Observação do ERP</div>
          <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
            {order.observations}
          </div>
        </div>
      )}

      {/* Observações operacionais — colapsado */}
      <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between px-2 text-xs">
            <span className="flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5" /> Observações
              {(notes.data?.length ?? 0) > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{notes.data?.length}</span>
              )}
            </span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", notesOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <ul className="space-y-1">
            {(notes.data ?? []).map((n) => (
              <li key={n.id} className="rounded-md border bg-surface p-2 text-xs">
                <div className="text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                <div>{n.body}</div>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Adicionar observação…"
              rows={2}
              className="text-sm"
            />
            <Button size="sm" onClick={submitNote} disabled={!note.trim() || addNote.isPending}>
              Salvar
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Histórico — colapsado */}
      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between px-2 text-xs">
            <span>Ver histórico</span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", historyOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {events.isLoading ? (
            <div className="text-xs text-muted-foreground">
              <Loader2 className="inline h-3 w-3 animate-spin" /> Carregando…
            </div>
          ) : (
            <OperationTimeline events={events.data ?? []} />
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Modal: Reagendar entrega */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reagendar entrega</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Nova data</label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Motivo *</label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)}>Cancelar</Button>
            <Button onClick={performReschedule} disabled={!reason.trim() || transition.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Definir recolha (chopeira) */}
      <Dialog open={defineOpen} onOpenChange={setDefineOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Definir recolha</DialogTitle></DialogHeader>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={async () => {
                setDefineOpen(false);
                await performTransition("customer_will_contact");
              }}
              disabled={busy}
              className="flex items-center gap-3 rounded-lg border p-4 text-left transition hover:bg-muted/40 disabled:opacity-50"
            >
              <Bell className="h-5 w-5 text-amber-600" />
              <div>
                <div className="font-medium">Cliente irá avisar</div>
                <div className="text-xs text-muted-foreground">Sem data agora — cliente entra em contato.</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setDefineOpen(false);
                setPickupOpen(true);
              }}
              disabled={busy}
              className="flex items-center gap-3 rounded-lg border p-4 text-left transition hover:bg-muted/40 disabled:opacity-50"
            >
              <CalendarClock className="h-5 w-5 text-sky-600" />
              <div>
                <div className="font-medium">Agendar recolha</div>
                <div className="text-xs text-muted-foreground">Data, hora e responsável (opcional).</div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Agendar recolha */}
      <Dialog open={pickupOpen} onOpenChange={setPickupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agendar recolha</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Data *</label>
              <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium">Período *</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["manha", "Manhã"],
                  ["tarde", "Tarde"],
                  ["dia_todo", "Dia todo"],
                ] as const).map(([val, lbl]) => {
                  const active = pickupPeriod === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPickupPeriod(val)}
                      className={cn(
                        "rounded-md border px-3 py-2 text-sm transition",
                        active
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : "border-border hover:bg-muted/40",
                      )}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Observação (opcional)</label>
              <Textarea value={pickupNote} onChange={(e) => setPickupNote(e.target.value)} rows={2} />
            </div>
            <div>
              <label className="text-xs font-medium">Responsável</label>
              <select
                value={pickupAssignee}
                onChange={(e) => setPickupAssignee(e.target.value)}
                className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              >
                <option value="">(opcional)</option>
                {(profilesQ.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name ?? "Sem nome"}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickupOpen(false)}>Cancelar</Button>
            <Button onClick={performSchedulePickup} disabled={!pickupDate || transition.isPending}>
              {transition.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Agendando…</> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar recolha (seleção de equipamentos) */}
      <Dialog open={confirmPickupOpen} onOpenChange={setConfirmPickupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar recolha</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">
              Marque apenas os equipamentos que realmente voltaram. Os não marcados continuam pendentes.
            </p>
            {order.equipments.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem equipamentos vinculados.</p>
            )}
            <ul className="divide-y rounded-md border">
              {order.equipments.map((e, i) => {
                const checked = returnedIdx.has(i);
                return (
                  <li key={i} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox
                      id={`eq-${i}`}
                      checked={checked}
                      onCheckedChange={(v) => {
                        setReturnedIdx((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(i); else next.delete(i);
                          return next;
                        });
                      }}
                    />
                    <label htmlFor={`eq-${i}`} className="flex flex-1 items-center justify-between text-sm">
                      <span>{e.type || "Equipamento"}</span>
                      <span className="text-xs text-muted-foreground">×{e.quantity}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPickupOpen(false)}>Cancelar</Button>
            <Button onClick={performConfirmPickup} disabled={transition.isPending}>
              {transition.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirmando…</> : "Confirmar recolha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────

function SectionCollapsible({
  open,
  onOpenChange,
  icon: Icon,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  icon: typeof Play;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between px-2 text-xs">
          <span className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5" /> {title}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function EquipmentList({ items }: { items: NormalizedEquipment[] }) {
  return (
    <ul className="divide-y rounded-md border text-sm">
      {items.slice(0, 20).map((it, i) => (
        <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="truncate">{it.type || "Equipamento"}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">×{it.quantity}</span>
        </li>
      ))}
    </ul>
  );
}

function ItemList({ items }: { items: NormalizedItem[] }) {
  const currency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <ul className="divide-y rounded-md border text-sm">
      {items.slice(0, 20).map((it, i) => (
        <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="truncate">{it.product || `Produto #${it.productId ?? "?"}`}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {it.quantity} × {currency(it.unitPrice)} = {currency(it.total)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AssignRow({
  label,
  currentName,
  profiles,
  disabled,
  isMe,
  onPick,
  onAssignMe,
}: {
  label: string;
  currentName: string | null;
  profiles: Array<{ id: string; full_name: string | null }>;
  disabled?: boolean;
  isMe?: boolean;
  onPick: (userId: string) => void;
  onAssignMe?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 flex-1 truncate", currentName ? "font-medium" : "text-muted-foreground")}>
        {currentName ?? "Sem responsável"}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={disabled}>
            Alterar
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1">
          {onAssignMe && !isMe && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAssignMe();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <UserPlus className="h-3.5 w-3.5" /> Atribuir a mim
            </button>
          )}
          <div className="my-1 h-px bg-border" />
          <div className="max-h-52 overflow-y-auto">
            {profiles.length === 0 && (
              <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum usuário disponível.</div>
            )}
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPick(p.id);
                }}
                className="block w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                {p.full_name ?? "Sem nome"}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}


function formatBrDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}`;
}

function PrimaryCTA({
  action,
  onClick,
  disabled,
}: {
  action: OperationAction;
  onClick: () => void;
  disabled?: boolean;
}) {
  const Icon = ACTION_ICON[action] ?? Play;
  // Cor primária para ações finais positivas
  const positive = action === "confirm_delivery" || action === "confirm_pickup";
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-14 w-full text-base font-semibold",
        positive && "bg-emerald-600 text-white hover:bg-emerald-700",
      )}
    >
      <Icon className="mr-2 h-5 w-5" /> {ACTION_LABEL[action]}
      {ACTIONS_WITH_DIALOG.has(action) && <ChevronDown className="ml-2 h-4 w-4 opacity-70" />}
    </Button>
  );
}
