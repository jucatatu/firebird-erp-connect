import { cn } from "@/lib/utils";
import type { OperationalStatus } from "@/lib/operations/types";

export function OperationalCounters({
  counts,
  className,
}: {
  counts: Record<OperationalStatus | "total", number>;
  className?: string;
}) {
  const cells: Array<[string, keyof typeof counts, string]> = [
    ["Total", "total", "bg-muted/50 text-foreground"],
    ["Pendentes", "pending", "bg-orange-50 text-orange-700"],
    ["Em atend.", "in_progress", "bg-blue-50 text-blue-700"],
    ["Entregues", "delivered", "bg-emerald-50 text-emerald-700"],
    ["Recolhidos", "collected", "bg-violet-50 text-violet-700"],
    ["Reagendados", "rescheduled", "bg-sky-50 text-sky-700"],
    ["Não local.", "not_found", "bg-muted text-muted-foreground"],
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