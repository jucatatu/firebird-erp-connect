import type { OperationEvent } from "@/lib/operations/types";
import { FileEdit, Play, CheckCircle2, PackageX, Bell, MapPinOff, CalendarClock, StickyNote, Wrench } from "lucide-react";

function eventInfo(e: OperationEvent) {
  switch (e.event_type) {
    case "loaded": return { title: "Pedido carregado", icon: FileEdit };
    case "started": return { title: "Atendimento iniciado", icon: Play };
    case "delivered": return { title: "Entrega confirmada", icon: CheckCircle2 };
    case "collected": return { title: "Recolha confirmada", icon: PackageX };
    case "customer_will_call": return { title: "Cliente irá avisar", icon: Bell };
    case "not_found": return { title: "Marcado como não localizado", icon: MapPinOff };
    case "rescheduled": return { title: "Reagendado", icon: CalendarClock };
    case "note_added": return { title: "Observação adicionada", icon: StickyNote };
    case "corrected": return { title: "Correção administrativa", icon: Wrench };
    case "delivery_assigned": return { title: "Entregador atribuído", icon: Play };
    case "delivery_assignee_changed": return { title: "Entregador alterado", icon: Play };
    case "delivery_started": return { title: "Entrega iniciada", icon: Play };
    case "delivery_confirmed": return { title: "Entrega concluída", icon: CheckCircle2 };
    case "delivery_customer_not_found": return { title: "Cliente não localizado", icon: MapPinOff };
    case "delivery_rescheduled": return { title: "Entrega reagendada", icon: CalendarClock };
    case "customer_will_contact": return { title: "Cliente irá avisar", icon: Bell };
    case "pickup_scheduled": return { title: "Recolha agendada", icon: CalendarClock };
    case "pickup_rescheduled": return { title: "Recolha reagendada", icon: CalendarClock };
    case "pickup_assigned": return { title: "Responsável da recolha atribuído", icon: Play };
    case "pickup_assignee_changed": return { title: "Responsável da recolha alterado", icon: Play };
    case "pickup_started": return { title: "Recolha iniciada", icon: Play };
    case "pickup_customer_not_found": return { title: "Cliente não localizado (recolha)", icon: MapPinOff };
    case "pickup_confirmed": return { title: "Recolha concluída", icon: PackageX };
    case "operation_completed": return { title: "Operação concluída", icon: CheckCircle2 };
    default: return { title: "Atualização", icon: FileEdit };
  }
}

export function OperationTimeline({ events }: { events: OperationEvent[] }) {
  if (!events || events.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem eventos ainda.</p>;
  }
  return (
    <ol className="relative space-y-3 border-l border-border pl-5">
      {events.map((e) => {
        const { title, icon: Icon } = eventInfo(e);
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-[27px] top-0.5 grid h-4 w-4 place-items-center rounded-full border border-border bg-surface">
              <Icon className="h-2.5 w-2.5 text-muted-foreground" />
            </span>
            <div className="flex items-center gap-2 text-sm font-medium leading-tight">
              {title}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
                {e.origin}
              </span>
            </div>
            {e.description && (
              <div className="text-[11px] text-muted-foreground">{e.description}</div>
            )}
            <div className="text-[11px] text-muted-foreground">
              {new Date(e.created_at).toLocaleString()}
            </div>
          </li>
        );
      })}
    </ol>
  );
}