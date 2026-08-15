import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMyRoles } from "@/hooks/use-auth";
import {
  useOrderDraft,
  useOrderDraftEvents,
  useTransitionDraft,
  useUpdateDraft,
} from "@/hooks/use-drafts";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge, STATUS_DESCRIPTION } from "@/components/status-badge";
import { OrderIdentifier, companyLabel } from "@/components/order-identifier";
import { OrderTimeline } from "@/components/order-timeline";
import { toast } from "sonner";
import { canEditErpOrder, getErpOrdersStatus, getErpOrderDetail, type ErpOrderStatus } from "@/lib/erp-orders.functions";
import { useOrderFormStore } from "@/hooks/use-order-form";
import { useErpOrderDetail } from "@/hooks/use-erp";

import {
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  Ban,
  RefreshCw,
  Save,
  Pencil,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pedidos-venda/$draftId")({
  head: () => ({
    meta: [
      { title: "Detalhe do pedido — ERP" },
      { name: "description", content: "Detalhe operacional do rascunho de pedido." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DraftDetailPage,
});

function DraftDetailPage() {
  const { draftId } = Route.useParams();

  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  const rolesQ = useMyRoles(user);
  const isAdmin = (rolesQ.data ?? []).includes("admin");
  const isApprover = (rolesQ.data ?? []).includes("aprovador") || isAdmin;

  const draftQ = useOrderDraft(draftId);
  const eventsQ = useOrderDraftEvents(draftId);
  const update = useUpdateDraft();
  const transition = useTransitionDraft();

  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [company, setCompany] = useState<"auto" | "1" | "3">("auto");
  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);

  useEffect(() => {
    if (!draftQ.data) return;
    setTitle(draftQ.data.title ?? "");
    setCustomerName(draftQ.data.customer_name_snapshot ?? "");
    setCompany(
      draftQ.data.company_id === 1 ? "1" : draftQ.data.company_id === 3 ? "3" : "auto",
    );
    const n = (draftQ.data.payload as Record<string, unknown> | null)?.notes;
    setNotes(typeof n === "string" ? n : "");
  }, [draftQ.data]);

  const [erpStatus, setErpStatus] = useState<ErpOrderStatus | null>(null);
  const getStatusFn = useServerFn(getErpOrdersStatus);
  const navigate = useNavigate();
  const editErpOrder = useOrderFormStore((s) => s.editErpOrder);

  useEffect(() => {
    const orderNum = draftQ.data?.erp_order_number;
    if (orderNum) {
      console.log("[ORDER DETAIL STATUS] FETCHING FOR:", orderNum);
      const fetchStatus = async () => {
        try {
          const res = await getStatusFn({ data: [Number(orderNum)] });
          console.log("[ORDER DETAIL STATUS] RESPONSE:", res);
          if (res.ok && res.data && res.data.length > 0) {
            setErpStatus(res.data[0]);
          }
        } catch (err) {
          console.error("[ORDER DETAIL STATUS] FETCH ERROR:", err);
        }
      };
      fetchStatus();
    }
  }, [draftQ.data?.erp_order_number, getStatusFn]);

  const draft = draftQ.data;
  const erpStatusId = erpStatus?.statusId ?? (draft?.payload && typeof draft.payload === 'object' && 'statusId' in (draft.payload as any) 
    ? (draft.payload as any).statusId 
    : null);

  const erpStatusDescription = erpStatus?.statusDescription || (draft?.payload && typeof draft.payload === 'object' && 'statusDescription' in (draft.payload as any) ? (draft.payload as any).statusDescription : null);

  const isOwner = draft?.created_by === user?.id;
  
  // REGRA OFICIAL DE EDIÇÃO (Sprint 8.9.29):
  // EDITABLE_STATUS_IDS = [1, 20, 24, 27]
  const canEdit = draft && (isOwner || isAdmin) && (
    draft.status === "draft" || 
    draft.status === "rejected" ||
    (draft.status === "sent" && erpStatus && !erpStatus.deleted && erpStatus.exists && erpStatus.canEdit)
  );

  const [isRefreshing, setIsRefreshing] = useState(false);
  const detailFn = useServerFn(getErpOrderDetail);

  const handleEdit = async () => {
    // SPRINT 8.9.36.1 — LOGS DE DIAGNÓSTICO
    console.log("[EDIT FLOW] click orderNumber=", draft?.erp_order_number);
    
    if (!draft?.erp_order_number) {
      toast.error("Número do pedido ERP não encontrado.");
      return;
    }
    
    console.log("[EDIT FLOW] navigating to /pedidos-venda/novo?edit=" + draft.erp_order_number);
    
    // NAVEGAÇÃO DIRETA SEM HIDRATAÇÃO (será feita no wizard)
    navigate({ 
      to: "/pedidos-venda/novo",
      search: { edit: String(draft.erp_order_number) } as any
    });
  };


  if (draftQ.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="rounded-md border p-6 text-center">
        <p className="text-sm">Pedido não encontrado.</p>
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link to="/pedidos-venda" search={{ status: "all", page: undefined }}>Voltar</Link>
        </Button>
      </div>
    );
  }



  const canSendForApproval = canEdit && (draft.status === "draft" || draft.status === "rejected");
  const canApprove = isApprover && draft.status === "pending_approval" && !(isOwner && !isAdmin);
  const canReject = isApprover && draft.status === "pending_approval";
  const canCancel =
    (draft.status === "draft" || draft.status === "rejected") && (isOwner || isAdmin);
  const canReopen = draft.status === "rejected" && (isOwner || isAdmin);

  const draftId_ = draft.id;
  const saveChanges = async () => {
    try {
      await update.mutateAsync({
        id: draftId_,
        title: title.trim() || null,
        customerName: customerName.trim() || null,
        companyId: company === "auto" ? null : (Number(company) as 1 | 3),
        notes: notes,
      });
      toast.success("Alterações salvas");
    } catch (err) {
      toast.error("Falha ao salvar", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  };

  const doTransition = async (
    newStatus: Parameters<typeof transition.mutateAsync>[0]["newStatus"],
    reason?: string,
  ) => {
    try {
      await transition.mutateAsync({ id: draftId_, newStatus, reason: reason ?? null });
      toast.success("Status atualizado");
    } catch (err) {
      toast.error("Não foi possível atualizar", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  };

  return (
    <div>
      <PageHeader
        title={draft.title || draft.customer_name_snapshot || "Pedido"}
        description={STATUS_DESCRIPTION[draft.status]}
        crumbs={[{ label: "Pedidos de venda", to: "/pedidos-venda" }, { label: "Detalhe" }]}
        actions={
          <div className="flex items-center gap-2">
            <OrderIdentifier id={draft.id} appOrderNumber={draft.app_order_number} />
            <StatusBadge status={draft.status} size="md" />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className={erpStatus?.deleted ? "border-destructive/40 bg-destructive/5" : ""}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-base">Dados do pedido</CardTitle>
                {erpStatusDescription && (
                  <div className={`flex items-center gap-1.5 text-xs font-bold uppercase ${erpStatus?.deleted || !erpStatus?.exists ? "text-destructive" : "text-primary"}`}>
                    ERP: {erpStatus?.exists === false ? "EXCLUÍDO (FÍSICO)" : erpStatusDescription}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {(erpStatus?.deleted || erpStatus?.exists === false) && (
                <div className="mb-4 rounded-md bg-destructive/10 p-3 text-xs text-destructive border border-destructive/20 font-medium">
                  Este pedido não existe mais no ERP e foi mantido no aplicativo apenas para histórico.
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase">Título</span>
                  <p className="text-sm font-semibold">{title || "—"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase">Cliente</span>
                  <p className="text-sm font-semibold">{customerName || "—"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase">Empresa</span>
                  <p className="text-sm font-semibold">{companyLabel(draft.company_id)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase">ID ERP</span>
                  <p className="text-sm font-semibold">{draft.erp_order_number || "—"}</p>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground uppercase">Observações</span>
                <p className="text-sm whitespace-pre-wrap">{notes || "Sem observações."}</p>
              </div>
            </CardContent>
          </Card>

          {draft.status === "rejected" && draft.rejection_reason && (
            <Card className="border-status-rejected-fg/40 bg-status-rejected-bg/40">
              <CardHeader>
                <CardTitle className="text-base text-status-rejected-fg">Motivo da rejeição</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{draft.rejection_reason}</p>
              </CardContent>
            </Card>
          )}

          {draft.status === "send_failed" && draft.last_send_error && (
            <Card className="border-status-failed-fg/40 bg-status-failed-bg/40">
              <CardHeader>
                <CardTitle className="text-base text-status-failed-fg">
                  Último erro no envio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-xs">{draft.last_send_error}</pre>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar: ações + timeline */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canSendForApproval && (
                <Button
                  className="w-full"
                  onClick={() => doTransition("pending_approval")}
                  disabled={transition.isPending}
                >
                  <Send className="mr-2 h-4 w-4" /> Enviar para aprovação
                </Button>
              )}
              {canApprove && (
                <Button
                  className="w-full"
                  variant="default"
                  onClick={() => doTransition("approved")}
                  disabled={transition.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
                </Button>
              )}
              {canReject && (
                <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full" variant="outline">
                      <XCircle className="mr-2 h-4 w-4" /> Rejeitar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Rejeitar pedido</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor="reason">Motivo da rejeição</Label>
                      <Textarea
                        id="reason"
                        rows={4}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Obrigatório. Será registrado no histórico.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setRejectOpen(false)}>
                        Cancelar
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={async () => {
                          if (!rejectReason.trim()) {
                            toast.error("Informe o motivo");
                            return;
                          }
                          await doTransition("rejected", rejectReason.trim());
                          setRejectOpen(false);
                          setRejectReason("");
                        }}
                        disabled={transition.isPending}
                      >
                        Confirmar rejeição
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              {canReopen && (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => doTransition("draft")}
                  disabled={transition.isPending}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Retornar para rascunho
                </Button>
              )}
              {canEdit && draft.status === "sent" && (
                <Button
                  className="w-full"
                  variant="default"
                  onClick={handleEdit}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Pencil className="mr-2 h-4 w-4" />
                  )}
                  Editar pedido
                </Button>
              )}
              {canCancel && (
                <Button
                  className="w-full"
                  variant="ghost"
                  onClick={() => doTransition("cancelled")}
                  disabled={transition.isPending}
                >
                  <Ban className="mr-2 h-4 w-4" /> Cancelar pedido
                </Button>
              )}
              <Button
                asChild
                className="w-full"
                variant="outline"
              >
                <Link to="/pedidos-venda" search={{ status: "all", page: undefined }}>Voltar à lista</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              {eventsQ.isLoading ? (
                <p className="text-xs text-muted-foreground">Carregando…</p>
              ) : (
                <OrderTimeline events={eventsQ.data ?? []} />
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}