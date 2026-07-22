import type { OrderDraftEventRow } from "@/hooks/use-drafts";
import { STATUS_LABEL } from "./status-badge";
import { FileEdit, Send, CheckCircle2, XCircle, Ban, RefreshCw, CheckCheck, AlertTriangle } from "lucide-react";

function eventInfo(e: OrderDraftEventRow) {
  if (e.event_type === "DRAFT_CREATED") return { title: "Rascunho criado", icon: FileEdit };
  if (e.event_type === "STATUS_CHANGED") {
    const s = e.new_status;
    if (s === "pending_approval") return { title: "Enviado para aprovação", icon: Send };
    if (s === "approved") return { title: "Aprovado", icon: CheckCircle2 };
    if (s === "rejected") return { title: "Rejeitado", icon: XCircle };
    if (s === "cancelled") return { title: "Cancelado", icon: Ban };
    if (s === "draft") return { title: "Retornado para edição", icon: RefreshCw };
    if (s === "sent") return { title: "Enviado ao ERP", icon: CheckCheck };
    if (s === "send_failed") return { title: "Falha no envio", icon: AlertTriangle };
    if (s === "sending") return { title: "Envio iniciado", icon: Send };
  }
  return { title: e.event_type, icon: FileEdit };
}

export function OrderTimeline({ events }: { events: OrderDraftEventRow[] }) {
  if (!events || events.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem eventos ainda.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {events.map((e) => {
        const { title, icon: Icon } = eventInfo(e);
        const reason = (e.metadata as Record<string, unknown> | null)?.reason;
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-[27px] top-0.5 grid h-4 w-4 place-items-center rounded-full border border-border bg-surface">
              <Icon className="h-2.5 w-2.5 text-muted-foreground" />
            </span>
            <div className="text-sm font-medium leading-tight">{title}</div>
            {e.previous_status && e.new_status && (
              <div className="text-[11px] text-muted-foreground">
                {STATUS_LABEL[e.previous_status]} → {STATUS_LABEL[e.new_status]}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground">
              {new Date(e.created_at).toLocaleString()}
            </div>
            {typeof reason === "string" && reason && (
              <div className="mt-1 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                Motivo: {reason}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}