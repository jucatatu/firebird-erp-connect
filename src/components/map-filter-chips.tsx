import { cn } from "@/lib/utils";
import { MAP_LAYERS, type MapLayerKey } from "@/lib/map-layers";

export function MapFilterChips({
  active,
  counts,
  onToggle,
  className,
}: {
  active: Set<MapLayerKey>;
  counts: Partial<Record<MapLayerKey, number>>;
  onToggle: (key: MapLayerKey) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      {MAP_LAYERS.map((layer) => {
        const isOn = active.has(layer.key);
        const count = counts[layer.key] ?? 0;
        return (
          <button
            key={layer.key}
            type="button"
            onClick={() => onToggle(layer.key)}
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
              style={{ backgroundColor: layer.colorVar, opacity: isOn ? 1 : 0.4 }}
            />
            <span>{layer.short}</span>
            <span
              className={cn(
                "rounded-full px-1.5 text-[10px] tabular-nums",
                isOn ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}