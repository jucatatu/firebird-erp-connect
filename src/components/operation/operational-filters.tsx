import { cn } from "@/lib/utils";
import {
  OPERATIONAL_STATUS_LABEL,
  OPERATIONAL_STATUS_COLOR,
  type OperationalStatus,
} from "@/lib/operations/types";

export type OperationalFilter = "all" | OperationalStatus;

const ORDER: OperationalFilter[] = [
  "all",
  "pending",
  "in_progress",
  "delivered",
  "collected",
  "customer_will_call",
  "not_found",
  "rescheduled",
];

export function OperationalFilters({
  active,
  counts,
  onChange,
  className,
}: {
  active: OperationalFilter;
  counts: Record<OperationalFilter, number>;
  onChange: (f: OperationalFilter) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      {ORDER.map((f) => {
        const isOn = active === f;
        const label = f === "all" ? "Todos" : OPERATIONAL_STATUS_LABEL[f];
        const color = f === "all" ? "#94a3b8" : OPERATIONAL_STATUS_COLOR[f];
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