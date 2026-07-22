import { useErpHealth } from "@/hooks/use-erp";
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";

export function ErpStatusIndicator({ detailed = false }: { detailed?: boolean }) {
  const q = useErpHealth();
  let dot = "bg-muted-foreground";
  let label = "Não verificado";
  if (q.isLoading) {
    dot = "bg-status-pending-fg";
    label = "Verificando";
  } else if (q.isError) {
    dot = "bg-status-failed-fg";
    label = "Indisponível";
  } else if (q.data) {
    const status = String(q.data.data?.status ?? "").toLowerCase();
    if (!q.data.ok) {
      dot = "bg-status-failed-fg";
      label = "Indisponível";
    } else
    if (status === "ok" || status === "healthy" || status === "up") {
      dot = "bg-status-approved-fg";
      label = "Online";
    } else {
      dot = "bg-status-pending-fg";
      label = "Instável";
    }
  }
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-surface px-2.5 py-1 text-xs",
        detailed && "px-3",
      )}
      title={`ERP: ${label}`}
    >
      <Activity className="h-3 w-3 text-muted-foreground" />
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      <span className="font-medium text-foreground/80">ERP · {label}</span>
    </div>
  );
}