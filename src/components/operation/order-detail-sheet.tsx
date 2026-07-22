import { useState } from "react";
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
  useOperationEvents,
  useOperationMutations,
  useOperationNotes,
} from "@/hooks/use-operations";
import { useGeocodeOrders } from "@/hooks/use-erp";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OperationTimeline } from "./operation-timeline";
import { cn } from "@/lib/utils";

type ActionKey = "in_progress" | "delivered" | "collected" | "customer_will_call" | "not_found";

const ACTION_LABEL: Record<ActionKey, string> = {
  in_progress: "Iniciar atendimento",
  delivered: "Marcar como entregue",
  collected: "Marcar como recolhido",
  customer_will_call: "Cliente irá avisar",
  not_found: "Não localizado",
};

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
  const onConflict = () => {
    toast.error("Este pedido foi alterado por outro usuário", {
      description: "Os dados serão atualizados automaticamente.",
    });
  };
  const { ensure, applyStatus, reschedule, addNote } = useOperationMutations(
    operationDate,
    companyId,
    onConflict,
  );
  const geocodeM = useGeocodeOrders();
  const qc = useQueryClient();

  const locSource = order.location?.source;
  const hasCoords =
    Number.isFinite(order.location?.latitude) &&
    Number.isFinite(order.location?.longitude);
  // Elegível para retry: pending/error/unresolved COM endereço e sem
  // coordenadas. NOT_GEOCODABLE ou já resolvido não mostram o botão.
  const canRetryGeocode =
    !hasCoords &&
    Boolean(addressText) &&
    erpId > 0 &&
    (locSource === "pending" || locSource === "unresolved" || locSource === "error");

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

  const [confirm, setConfirm] = useState<ActionKey | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState(operationDate);
  const [reason, setReason] = useState("");
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
    });
    return created.id;
  }

  async function performAction(action: ActionKey) {
    try {
      const id = await ensureStateId();
      const res = await applyStatus.mutateAsync({
        stateId: id,
        status: action as OperationalStatus,
        expectedVersion: state?.version ?? 1,
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
    try {
      const id = await ensureStateId();
      const res = await reschedule.mutateAsync({
        stateId: id,
        newDate,
        reason: reason.trim(),
        expectedVersion: state?.version ?? 1,
      });
      setRescheduleOpen(false);
      setReason("");
      onAfterAction?.(res);
    } catch (err) {
      if (!(err instanceof OperationConflictError)) {
        toast.error("Não foi possível reagendar", {
          description: (err as Error)?.message ?? String(err),
        });
      }
    }
  }

  async function submitNote() {
    if (!note.trim()) return;
    const id = await ensureStateId();
    await addNote.mutateAsync({ stateId: id, body: note.trim() });
    setNote("");
  }

  const currentStatus = state?.operational_status ?? "pending";
  const busy = ensure.isPending || applyStatus.isPending || reschedule.isPending;

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
            {state?.operational_date && state.operational_date !== operationDate && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
                Reagendado localmente → {state.operational_date}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
          <X className="h-4 w-4" />
        </Button>
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

      {order.equipments.length > 0 && (
        <EquipmentList items={order.equipments} />
      )}
      {order.items.length > 0 && (
        <ItemList items={order.items} />
      )}

      {order.observations && (
        <div>
          <div className="mb-1 text-xs font-medium">Observação do ERP</div>
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
            {order.observations}
          </div>
        </div>
      )}

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

      <div className="rounded-lg border bg-surface p-3">
        <div className="mb-2 text-xs font-medium">Ações operacionais</div>
        <div className="grid grid-cols-2 gap-2">
          <ActionButton icon={Play} label="Iniciar" onClick={() => setConfirm("in_progress")} disabled={busy || currentStatus === "in_progress"} />
          <ActionButton icon={CheckCircle2} label="Entregar" tone="success" onClick={() => setConfirm("delivered")} disabled={busy} />
          <ActionButton icon={PackageX} label="Recolher" tone="violet" onClick={() => setConfirm("collected")} disabled={busy} />
          <ActionButton icon={Bell} label="Cliente avisa" tone="warning" onClick={() => setConfirm("customer_will_call")} disabled={busy} />
          <ActionButton icon={MapPinOff} label="Não localizado" tone="muted" onClick={() => setConfirm("not_found")} disabled={busy} />
          <ActionButton icon={CalendarClock} label="Reagendar" tone="sky" onClick={() => setRescheduleOpen(true)} disabled={busy} />
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

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmar {confirm ? ACTION_LABEL[confirm].toLowerCase() : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                <div><strong>Cliente:</strong> {name}</div>
                {addressText && <div><strong>Endereço:</strong> {addressText}</div>}
                <div><strong>Pedido:</strong> #{orderNumber}</div>
                {order.equipments.length > 0 && (
                  <div><strong>Equipamentos:</strong> {order.equipments.length}</div>
                )}
                {order.items.length > 0 && (
                  <div><strong>Itens:</strong> {order.items.length}</div>
                )}
                {order.observations && (
                  <div className="text-xs text-muted-foreground">Obs ERP: {order.observations}</div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) {
                  const a = confirm;
                  setConfirm(null);
                  performAction(a);
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar pedido</DialogTitle>
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
            <Button onClick={performReschedule} disabled={!reason.trim() || reschedule.isPending}>
              Confirmar reagendamento
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

function ActionButton({
  icon: Icon,
  label,
  tone,
  onClick,
  disabled,
}: {
  icon: typeof Play;
  label: string;
  tone?: "success" | "warning" | "muted" | "sky" | "violet";
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