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
} from "lucide-react";
import type { MapOrder } from "@/lib/erp.functions";
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
  order: MapOrder;
  state: OperationState | null;
  operationDate: string;
  companyId?: number | null;
  onClose: () => void;
  onAfterAction?: (state: OperationState) => void;
}) {
  const name = order.customerName || order.clientName || "(sem cliente)";
  const orderNumber = order.orderNumber ?? order.orderId ?? "—";
  const erpId = Number(order.orderId ?? order.orderNumber ?? 0);
  const mapsUrl = order.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`
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

  const [confirm, setConfirm] = useState<ActionKey | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState(operationDate);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  async function ensureStateId(): Promise<string> {
    if (state) return state.id;
    const created = await ensure.mutateAsync({
      erpOrderId: erpId,
      erpOrderNumber: order.orderNumber ?? null,
      companyId: order.companyId ?? null,
      operationDate,
      customerName: order.customerName || order.clientName,
      address: order.address,
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

      {order.address && (
        <div className="rounded-md border p-3 text-sm">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Endereço</div>
          <div>{order.address}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        {order.phone && <Field label="Telefone" value={String(order.phone)} />}
        {order.period && <Field label="Período" value={String(order.period)} />}
        {order.deliveryDate && <Field label="Entrega (ERP)" value={String(order.deliveryDate)} />}
        {order.companyId != null && (
          <Field
            label="Empresa"
            value={order.companyId === 3 ? "Grott" : order.companyId === 1 ? "Graal" : String(order.companyId)}
          />
        )}
      </div>

      {Array.isArray(order.equipment) && order.equipment.length > 0 && (
        <CollectionList title="Equipamentos" items={order.equipment} />
      )}
      {Array.isArray(order.items) && order.items.length > 0 && (
        <CollectionList title="Itens" items={order.items} />
      )}

      {order.notes && (
        <div>
          <div className="mb-1 text-xs font-medium">Observação do ERP</div>
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
            {order.notes}
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
                {order.address && <div><strong>Endereço:</strong> {order.address}</div>}
                <div><strong>Pedido:</strong> #{orderNumber}</div>
                {Array.isArray(order.equipment) && (
                  <div><strong>Equipamentos:</strong> {order.equipment.length}</div>
                )}
                {Array.isArray(order.items) && (
                  <div><strong>Itens:</strong> {order.items.length}</div>
                )}
                {order.notes && (
                  <div className="text-xs text-muted-foreground">Obs ERP: {order.notes}</div>
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
              A data original do ERP ({order.deliveryDate ? String(order.deliveryDate) : "—"}) permanece inalterada.
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

function CollectionList({ title, items }: { title: string; items: unknown[] }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium">{title}</div>
      <ul className="divide-y rounded-md border text-sm">
        {items.slice(0, 20).map((it, i) => (
          <li key={i} className="px-3 py-2">
            {typeof it === "object" && it && "description" in it
              ? String((it as { description: unknown }).description)
              : JSON.stringify(it)}
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