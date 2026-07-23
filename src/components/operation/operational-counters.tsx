import { cn } from "@/lib/utils";
import type { OperationalFilter } from "./operational-filters";

export type CounterBuckets = Partial<Record<OperationalFilter, number>> & { total: number };

export function OperationalCounters({
  counts,
  className,
}: {
  counts: CounterBuckets;
  className?: string;
}) {
  const cells: Array<[string, keyof CounterBuckets, string]> = [
    ["Total", "total", "bg-muted/50 text-foreground"],
    ["Entregas", "deliveries", "bg-amber-50 text-amber-800"],
    ["Recolhas", "pickups", "bg-emerald-50 text-emerald-700"],
    ["Cliente avisará", "customer_will_call", "bg-orange-50 text-orange-700"],
    ["Concluídos", "completed", "bg-slate-100 text-slate-700"],
  ];
  return (
    <div className={cn("grid grid-cols-5 gap-1 text-center text-[10px]", className)}>
      {cells.map(([label, key, cls]) => (
        <div key={label} className={cn("rounded-md py-1", cls)}>
          <div className="text-sm font-semibold tabular-nums">{counts[key] ?? 0}</div>
          <div className="opacity-80">{label}</div>
        </div>
      ))}
    </div>
  );
}
