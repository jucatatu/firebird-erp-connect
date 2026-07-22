import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMyRoles, primaryRole } from "@/hooks/use-auth";
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
import {
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  Ban,
  RefreshCw,
  Save,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders/$draftId")({
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
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  const rolesQ = useMyRoles(user);
  const role = primaryRole(rolesQ.data);
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

  if (draftQ.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const draft = draftQ.data;
  if (!draft) {
    return (
      <div className="rounded-md border p-6 text-center">
        <p className="text-sm">Pedido não encontrado.</p>
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link to="/orders">Voltar</Link>
        </Button>
      </div>
    );
  }

  const isOwner = draft.created_by === user?.id;
  const canEdit = (isOwner || isAdmin) && (draft.status === "draft" || draft.status === "rejected");
  const canSendForApproval = canEdit;
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
        crumbs={[{ label: "Pedidos", to: "/orders" }, { label: "Detalhe" }]}
        actions={
          <div className="flex items-center gap-2">
            <OrderIdentifier id={draft.id} />
            <StatusBadge status={draft.status} size="md" />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* Cliente / dados */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Dados do pedido</CardTitle>
              {!canEdit && (
                <span className="text-xs text-muted-foreground">Somente leitura no status atual</span>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="d-title">Título</Label>
                  <Input
                    id="d-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="d-customer">Cliente</Label>
                  <Input
                    id="d-customer"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Select
                    value={company}
                    onValueChange={(v) => setCompany(v as "auto" | "1" | "3")}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automática</SelectItem>
                      <SelectItem value="1">Graal (1)</SelectItem>
                      <SelectItem value="3">Grott (3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Resolução atual</Label>
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    {companyLabel(draft.company_id)}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-notes">Observações</Label>
                <Textarea
                  id="d-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!canEdit}
                  rows={4}
                />
              </div>
              {canEdit && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={saveChanges} disabled={update.isPending}>
                    {update.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar alterações
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Próximas etapas (placeholder informativo) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Itens, entrega e pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                Estas seções serão liberadas nas próximas fases do sistema.
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
                <Link to="/orders">Voltar à lista</Link>
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