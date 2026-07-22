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
    ["Pendentes", "pending_delivery", "bg-orange-50 text-orange-700"],
    ["Em entrega", "in_delivery", "bg-blue-50 text-blue-700"],
    ["Aguard. recolh.", "awaiting_pickup", "bg-amber-50 text-amber-700"],
    ["Recolh. agend.", "pickup_scheduled", "bg-sky-50 text-sky-700"],
    ["Em recolh.", "in_pickup", "bg-violet-50 text-violet-700"],
    ["Finalizados", "completed", "bg-emerald-50 text-emerald-700"],
  ];
  return (
    <div className={cn("grid grid-cols-4 gap-1 text-center text-[10px]", className)}>
      {cells.map(([label, key, cls]) => (
        <div key={label} className={cn("rounded-md py-1", cls)}>
          <div className="text-sm font-semibold tabular-nums">{counts[key] ?? 0}</div>
          <div className="opacity-80">{label}</div>
        </div>
      ))}
    </div>
  );
}