import type { OrderDraftStatus } from "@/hooks/use-drafts";
import { cn } from "@/lib/utils";
import {
  FileEdit,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  CheckCheck,
  AlertTriangle,
  Ban,
} from "lucide-react";

export const STATUS_LABEL: Record<OrderDraftStatus, string> = {
  draft: "Rascunho",
  pending_approval: "Aguardando aprovação",
  approved: "Aprovado",
  rejected: "Rejeitado",
  sending: "Enviando ao ERP",
  sent: "Enviado ao ERP",
  send_failed: "Falha no envio",
  cancelled: "Cancelado",
};

export const STATUS_DESCRIPTION: Record<OrderDraftStatus, string> = {
  draft: "Em elaboração pelo autor.",
  pending_approval: "Aguardando revisão de um aprovador.",
  approved: "Pedido aprovado e pronto para integração com o ERP.",
  rejected: "Revise os dados indicados antes de reenviar.",
  sending: "Envio em andamento para o ERP.",
  sent: "Pedido registrado no ERP.",
  send_failed: "Falha na integração. Verifique e reenvie.",
  cancelled: "Este pedido foi cancelado.",
};

const STATUS_STYLE: Record<OrderDraftStatus, string> = {
  draft: "bg-status-draft-bg text-status-draft-fg",
  pending_approval: "bg-status-pending-bg text-status-pending-fg",
  approved: "bg-status-approved-bg text-status-approved-fg",
  rejected: "bg-status-rejected-bg text-status-rejected-fg",
  sending: "bg-status-sent-bg text-status-sent-fg",
  sent: "bg-status-sent-bg text-status-sent-fg",
  send_failed: "bg-status-failed-bg text-status-failed-fg",
  cancelled: "bg-status-cancelled-bg text-status-cancelled-fg",
};

const STATUS_ICON: Record<OrderDraftStatus, typeof FileEdit> = {
  draft: FileEdit,
  pending_approval: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  sending: Send,
  sent: CheckCheck,
  send_failed: AlertTriangle,
  cancelled: Ban,
};

export function StatusBadge({
  status,
  className,
  size = "sm",
}: {
  status: OrderDraftStatus;
  className?: string;
  size?: "sm" | "md";
}) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        STATUS_STYLE[status],
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {STATUS_LABEL[status]}
    </span>
  );
}