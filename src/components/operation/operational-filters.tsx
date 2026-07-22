import { cn } from "@/lib/utils";
import type { OperationalStatus } from "@/lib/operations/types";

/**
 * Buckets funcionais para a barra de filtros. Um bucket agrupa vários
 * `operational_status` para refletir o fluxo operacional real.
 */
export type OperationalFilter =
  | "all"
  | "pending_delivery"
  | "in_delivery"
  | "awaiting_pickup"
  | "pickup_scheduled"
  | "in_pickup"
  | "completed";

export const FILTER_ORDER: OperationalFilter[] = [
  "all",
  "pending_delivery",
  "in_delivery",
  "awaiting_pickup",
  "pickup_scheduled",
  "in_pickup",
  "completed",
];

export const FILTER_LABEL: Record<OperationalFilter, string> = {
  all: "Todos",
  pending_delivery: "Pendentes",
  in_delivery: "Em entrega",
  awaiting_pickup: "Aguardando recolhimento",
  pickup_scheduled: "Recolh. agendado",
  in_pickup: "Em recolhimento",
  completed: "Finalizados",
};

export const FILTER_COLOR: Record<OperationalFilter, string> = {
  all: "#94a3b8",
  pending_delivery: "#ea6a2a",
  in_delivery: "#2563eb",
  awaiting_pickup: "#f59e0b",
  pickup_scheduled: "#0ea5e9",
  in_pickup: "#7c3aed",
  completed: "#16a34a",
};

/** Mapeia um status persistido em um bucket funcional. */
export function filterOfStatus(status: OperationalStatus): OperationalFilter {
  switch (status) {
    case "pending":
    case "rescheduled":
    case "not_found":
      return "pending_delivery";
    case "in_progress":
      return "in_delivery";
    case "awaiting_pickup_definition":
    case "awaiting_customer_contact":
    case "customer_will_call":
      return "awaiting_pickup";
    case "pickup_scheduled":
      return "pickup_scheduled";
    case "pickup_in_progress":
      return "in_pickup";
    case "delivered":
    case "pickup_completed":
    case "collected":
      return "completed";
    default:
      return "pending_delivery";
  }
}

export function OperationalFilters({
  active,
  counts,
  onChange,
  className,
}: {
  active: OperationalFilter;
  counts: Partial<Record<OperationalFilter, number>>;
  onChange: (f: OperationalFilter) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      {FILTER_ORDER.map((f) => {
        const isOn = active === f;
        const label = FILTER_LABEL[f];
        const color = FILTER_COLOR[f];
        return (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            aria-pressed={isOn}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
              isOn
                ? "border-transparent bg-surface text-foreground shadow-sm"
                : "border-border bg-background/60 text-muted-foreground",
            )}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color, opacity: isOn ? 1 : 0.5 }}
            />
            <span>{label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 text-[10px] tabular-nums",
                isOn ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              {counts[f] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}