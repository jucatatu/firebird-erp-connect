import { cn } from "@/lib/utils";
import type { OperationalStatus } from "@/lib/operations/types";

/**
 * Buckets funcionais simplificados para a barra de filtros do mapa/listas.
 * Reduzidos para as 4 categorias operacionais + "Todos". Sem overflow
 * horizontal: usam flex-wrap para caberem em qualquer largura.
 */
export type OperationalFilter =
  | "all"
  | "deliveries"
  | "pickups"
  | "customer_will_call"
  | "completed";

export const FILTER_ORDER: OperationalFilter[] = [
  "all",
  "deliveries",
  "pickups",
  "customer_will_call",
  "completed",
];

export const FILTER_LABEL: Record<OperationalFilter, string> = {
  all: "Todos",
  deliveries: "Entregas",
  pickups: "Recolhas",
  customer_will_call: "Cliente irá avisar",
  completed: "Concluídos",
};

export const FILTER_COLOR: Record<OperationalFilter, string> = {
  all: "#94a3b8",
  deliveries: "#d99a22",         // ouro
  pickups: "#16a34a",            // verde
  customer_will_call: "#f59e0b", // âmbar
  completed: "#6b7280",          // cinza
};

/**
 * Mapeia um status persistido em um bucket funcional. `awaiting_pickup_definition`
 * é considerado uma recolha (aguardando definição) para filtragem — a UI
 * separada mostra o rótulo "Definir recolha".
 */
export function filterOfStatus(status: OperationalStatus): OperationalFilter {
  switch (status) {
    case "pending":
    case "in_progress":
    case "rescheduled":
    case "not_found":
      return "deliveries";
    case "awaiting_pickup_definition":
    case "awaiting_customer_contact":
    case "pickup_scheduled":
    case "pickup_in_progress":
      return "pickups";
    case "customer_will_call":
      return "customer_will_call";
    case "delivered":
    case "collected":
    case "pickup_completed":
      return "completed";
    default:
      return "deliveries";
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
    <div className={cn("flex flex-wrap gap-1.5", className)}>
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
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
              isOn
                ? "border-transparent bg-surface text-foreground shadow-sm"
                : "border-border bg-background/60 text-muted-foreground",
            )}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: color, opacity: isOn ? 1 : 0.5 }}
            />
            <span>{label}</span>
            <span
              className={cn(
                "rounded-full px-1 text-[10px] tabular-nums",
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
