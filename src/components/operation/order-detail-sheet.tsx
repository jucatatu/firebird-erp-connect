import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ExternalLink,
  Phone,
  X,
  Play,
  CheckCircle2,
  PackageX,
  Bell,
  MapPinOff,
  CalendarClock,
  StickyNote,
  Loader2,
  MapPin,
  UserPlus,
  Truck,
} from "lucide-react";
import type {
  NormalizedEquipment,
  NormalizedItem,
  NormalizedMapOrder,
} from "@/lib/erp.functions";
import {
  OPERATIONAL_STATUS_LABEL,
  OperationConflictError,
  type OperationState,
  type OperationalStatus,
} from "@/lib/operations/types";
import {
  ACTION_LABEL,
  getAllowedOperationalActions,
  operationContext,
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

const ACTION_TONE: Partial<Record<OperationAction, ButtonTone>> = {
  start_delivery: undefined,
  confirm_delivery: "success",
  delivery_not_found: "muted",
  reschedule_delivery: "sky",
  customer_will_contact: "warning",
  schedule_pickup: "sky",
  start_pickup: undefined,
  confirm_pickup: "violet",
  pickup_not_found: "muted",
};

type ButtonTone = "success" | "warning" | "muted" | "sky" | "violet" | undefined;

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
  const ctx = operationContext(currentStatus);

  const allowedActions = useMemo(
    () => getAllowedOperationalActions({ status: currentStatus, hasReturnableEquipment: hasReturnable }),
    [currentStatus, hasReturnable],
  );

  const profileById = useMemo(() => {
    const map = new Map<string, string>();
    (profilesQ.data ?? []).forEach((p) => map.set(p.id, p.full_name ?? "Sem nome"));
    return map;
  }, [profilesQ.data]);
  const nameOf = (id: string | null | undefined) =>
    id ? profileById.get(id) ?? "Usuário" : "Não atribuído";

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
  const [confirmAction, setConfirmAction] = useState<OperationAction | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState(operationDate);
  const [reason, setReason] = useState("");
  const [pickupOpen, setPickupOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState(operationDate);
  const [pickupTime, setPickupTime] = useState("");
  const [pickupNote, setPickupNote] = useState("");
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
    } catch (err) {
      if (!(err instanceof OperationConflictError)) {
        toast.error("Não foi possível aplicar a ação", {
          description: (err as Error)?.message ?? String(err),
        });
      }
    }
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
    await performTransition("schedule_pickup", {
      scheduledDate: pickupDate,
      scheduledTime: pickupTime || undefined,
      note: pickupNote || undefined,
    });
    setPickupOpen(false);
    setPickupNote("");
    setPickupTime("");
  }

  async function submitNote() {
    if (!note.trim()) return;
    const id = await ensureStateId();
    await addNote.mutateAsync({ stateId: id, body: note.trim() });
    setNote("");
  }

  async function assign(role: "delivery" | "pickup", userId: string) {
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

  function handleActionClick(action: OperationAction) {
    if (action === "reschedule_delivery") {
      setRescheduleOpen(true);
      return;
    }
    if (action === "schedule_pickup") {
      setPickupOpen(true);
      return;
    }
    setConfirmAction(action);
  }

  const deliveryAssigneeId = state?.delivery_assignee_id ?? null;
  const pickupAssigneeId = state?.pickup_assignee_id ?? null;

  const nextActionLabel =
    allowedActions.length > 0 ? ACTION_LABEL[allowedActions[0]] : "Operação concluída";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Pedido #{orderNumber}
          </div>
          <h2 className="truncate text-lg font-semibold">{name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
              {OPERATIONAL_STATUS_LABEL[currentStatus]}
            </span>
            {hasReturnable && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800">
                Requer recolhimento
              </span>
            )}
            {state?.operational_date && state.operational_date !== operationDate && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
                Reagendado → {state.operational_date}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Resumo operacional */}
      <div className="rounded-lg border bg-surface p-3 text-xs">
        <div className="grid gap-2 sm:grid-cols-2">
          <SummaryLine label="Status" value={OPERATIONAL_STATUS_LABEL[currentStatus]} />
          <SummaryLine label="Próxima ação" value={nextActionLabel} />
          <SummaryLine label="Entregador" value={nameOf(deliveryAssigneeId)} />
          {hasReturnable && (
            <SummaryLine label="Recolhimento" value={nameOf(pickupAssigneeId)} />
          )}
          {state?.pickup_scheduled_date && (
            <SummaryLine
              label="Recolh. agendado"
              value={
                state.pickup_scheduled_time
                  ? `${state.pickup_scheduled_date} às ${state.pickup_scheduled_time}`
                  : state.pickup_scheduled_date
              }
            />
          )}
        </div>
      </div>

      {addressText && (
        <div className="rounded-md border p-3 text-sm">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Endereço</div>
          <div>{addressText}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        {order.phone && <Field label="Telefone" value={order.phone} />}
        {order.period && <Field label="Período" value={order.period} />}
        {order.deliveryDate && <Field label="Entrega (ERP)" value={order.deliveryDate} />}
        {order.returnDate && <Field label="Retorno (ERP)" value={order.returnDate} />}
        {order.companyId != null && (
          <Field
            label="Empresa"
            value={order.companyId === 3 ? "Grott" : order.companyId === 1 ? "Graal" : String(order.companyId)}
          />
        )}
        {order.erpStatus && <Field label="Status ERP" value={order.erpStatus} />}
      </div>

      {order.equipments.length > 0 && <EquipmentList items={order.equipments} />}
      {order.items.length > 0 && <ItemList items={order.items} />}

      {order.observations && (
        <div>
          <div className="mb-1 text-xs font-medium">Observação do ERP</div>
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
            {order.observations}
          </div>
        </div>
      )}

      {/* Atribuição */}
      <div className="rounded-lg border bg-surface p-3">
        <div className="mb-2 text-xs font-medium">Atribuição</div>
        <AssigneePicker
          label="Entrega"
          currentId={deliveryAssigneeId}
          profiles={profilesQ.data ?? []}
          disabled={busy}
          onAssign={(uid) => assign("delivery", uid)}
          onAssignMe={user ? () => assign("delivery", user.id) : undefined}
        />
        {hasReturnable && (
          <div className="mt-2">
            <AssigneePicker
              label="Recolhimento"
              currentId={pickupAssigneeId}
              profiles={profilesQ.data ?? []}
              disabled={busy}
              onAssign={(uid) => assign("pickup", uid)}
              onAssignMe={user ? () => assign("pickup", user.id) : undefined}
            />
          </div>
        )}
      </div>

      {/* Ações contextuais */}
      <div className="rounded-lg border bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-medium">
            Ações — {ctx === "pickup" ? "Recolhimento" : "Entrega"}
          </div>
          {allowedActions.length === 0 && (
            <span className="text-[10px] text-muted-foreground">Operação finalizada</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {allowedActions.map((action) => {
            const Icon = ACTION_ICON[action] ?? Play;
            return (
              <ActionButton
                key={action}
                icon={Icon}
                label={ACTION_LABEL[action]}
                tone={ACTION_TONE[action]}
                onClick={() => handleActionClick(action)}
                disabled={busy}
              />
            );
          })}
        </div>
      </div>

      {/* Notas operacionais */}
      <div>
        <div className="mb-1 text-xs font-medium">Observações da operação</div>
        <ul className="space-y-1">
          {(notes.data ?? []).map((n) => (
            <li key={n.id} className="rounded-md border bg-surface p-2 text-xs">
              <div className="text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
              <div>{n.body}</div>
            </li>
          ))}
          {(notes.data ?? []).length === 0 && (
            <li className="text-[11px] text-muted-foreground">Sem observações locais ainda.</li>
          )}
        </ul>
        <div className="mt-2 flex gap-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Adicionar observação operacional…"
            rows={2}
            className="text-sm"
          />
          <Button size="sm" onClick={submitNote} disabled={!note.trim() || addNote.isPending}>
            <StickyNote className="mr-1 h-3.5 w-3.5" /> Salvar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
        {canRetryGeocode && (
          <Button
            size="sm"
            variant="outline"
            onClick={retryGeocode}
            disabled={geocodeM.isPending}
          >
            {geocodeM.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Localizando…
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" /> Tentar localizar
              </>
            )}
          </Button>
        )}
      </div>

      <div>
        <div className="mb-2 text-xs font-medium">Histórico operacional</div>
        {events.isLoading ? (
          <div className="text-xs text-muted-foreground">
            <Loader2 className="inline h-3 w-3 animate-spin" /> Carregando…
          </div>
        ) : (
          <OperationTimeline events={events.data ?? []} />
        )}
      </div>

      {/* Confirmação de ação simples */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(o) => !o && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmar “{confirmAction ? ACTION_LABEL[confirmAction] : ""}”?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                <div><strong>Cliente:</strong> {name}</div>
                {addressText && <div><strong>Endereço:</strong> {addressText}</div>}
                <div><strong>Pedido:</strong> #{orderNumber}</div>
                {confirmAction === "confirm_delivery" && hasReturnable && (
                  <div className="mt-2 rounded bg-violet-50 p-2 text-xs text-violet-800">
                    Este pedido possui equipamentos retornáveis. Após confirmar a
                    entrega será obrigatório definir o recolhimento.
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) {
                  const a = confirmAction;
                  setConfirmAction(null);
                  performTransition(a);
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reagendar entrega */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar entrega</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Nova data</label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Motivo *</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Descreva o motivo do reagendamento"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              A data original do ERP ({order.deliveryDate ?? "—"}) permanece inalterada.
              Apenas a agenda operacional local será atualizada.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)}>Cancelar</Button>
            <Button onClick={performReschedule} disabled={!reason.trim() || transition.isPending}>
              Confirmar reagendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agendar recolhimento */}
      <Dialog open={pickupOpen} onOpenChange={setPickupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar recolhimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded bg-muted/40 p-2 text-xs">
              <div><strong>Cliente:</strong> {name}</div>
              <div><strong>Pedido:</strong> #{orderNumber}</div>
              {order.equipments.length > 0 && (
                <div>
                  <strong>Equipamentos:</strong>{" "}
                  {order.equipments
                    .map((e) => `${e.type || "Equipamento"} ×${e.quantity}`)
                    .join(", ")}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Data *</label>
                <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium">Horário</label>
                <Input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Observação</label>
              <Textarea
                value={pickupNote}
                onChange={(e) => setPickupNote(e.target.value)}
                rows={2}
                placeholder="Instruções para o recolhimento (opcional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickupOpen(false)}>Cancelar</Button>
            <Button onClick={performSchedulePickup} disabled={!pickupDate || transition.isPending}>
              {transition.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Agendando…</>
              ) : (
                "Confirmar agendamento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  );
}

function EquipmentList({ items }: { items: NormalizedEquipment[] }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium">Equipamentos</div>
      <ul className="divide-y rounded-md border text-sm">
        {items.slice(0, 20).map((it, i) => (
          <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="truncate">{it.type || "Equipamento"}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">×{it.quantity}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ItemList({ items }: { items: NormalizedItem[] }) {
  const currency = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <div>
      <div className="mb-1 text-xs font-medium">Itens</div>
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
    </div>
  );
}

function AssigneePicker({
  label,
  currentId,
  profiles,
  disabled,
  onAssign,
  onAssignMe,
}: {
  label: string;
  currentId: string | null;
  profiles: Array<{ id: string; full_name: string | null }>;
  disabled?: boolean;
  onAssign: (userId: string) => void;
  onAssignMe?: () => void;
}) {
  const currentName =
    currentId ? profiles.find((p) => p.id === currentId)?.full_name ?? "Usuário" : null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="min-w-16 text-muted-foreground">{label}:</span>
      <span className="font-medium">{currentName ?? "Não atribuído"}</span>
      <div className="ml-auto flex items-center gap-2">
        <Select
          value=""
          onValueChange={(v) => onAssign(v)}
          disabled={disabled || profiles.length === 0}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Selecionar…" />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name ?? "Sem nome"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {onAssignMe && (
          <Button size="sm" variant="outline" onClick={onAssignMe} disabled={disabled}>
            <UserPlus className="mr-1 h-3 w-3" /> A mim
          </Button>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  tone,
  onClick,
  disabled,
}: {
  icon: typeof Play;
  label: string;
  tone?: ButtonTone;
  onClick: () => void;
  disabled?: boolean;
}) {
  const toneCls =
    tone === "success"
      ? "hover:bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warning"
        ? "hover:bg-amber-50 text-amber-800 border-amber-200"
        : tone === "muted"
          ? "hover:bg-muted text-muted-foreground"
          : tone === "sky"
            ? "hover:bg-sky-50 text-sky-700 border-sky-200"
            : tone === "violet"
              ? "hover:bg-violet-50 text-violet-700 border-violet-200"
              : "";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-11 items-center justify-center gap-2 rounded-md border bg-surface px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        toneCls,
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}