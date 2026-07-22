import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMyRoles, primaryRole } from "@/hooks/use-auth";
import {
  useOrderDraft,
  useOrderDraftEvents,
  useUpdateDraft,
  useTransitionDraft,
  type OrderDraftStatus,
} from "@/hooks/use-drafts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders/$draftId")({
  head: () => ({
    meta: [
      { title: "Detalhe do rascunho — Pedidos ERP" },
      { name: "description", content: "Detalhe e histórico do rascunho de pedido." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DraftDetailPage,
});

const STATUS_LABEL: Record<OrderDraftStatus, string> = {
  draft: "Rascunho",
  pending_approval: "Aguardando aprovação",
  approved: "Aprovado",
  rejected: "Rejeitado",
  sending: "Enviando",
  sent: "Enviado",
  send_failed: "Falha no envio",
  cancelled: "Cancelado",
};

type CompanyChoice = "auto" | "1" | "3";

function DraftDetailPage() {
  const { draftId } = Route.useParams();
  const navigate = useNavigate();
  const draftQ = useOrderDraft(draftId);
  const eventsQ = useOrderDraftEvents(draftId);
  const update = useUpdateDraft();
  const transition = useTransitionDraft();

  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  const rolesQ = useMyRoles(user);
  const role = primaryRole(rolesQ.data);
  const roles = rolesQ.data ?? [];
  const isAdmin = roles.includes("admin");
  const isApprover = roles.includes("aprovador") || isAdmin;

  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [company, setCompany] = useState<CompanyChoice>("auto");
  const [notes, setNotes] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    const d = draftQ.data;
    if (!d) return;
    setTitle(d.title ?? "");
    setCustomerName(d.customer_name_snapshot ?? "");
    setCompany(d.company_id === 1 ? "1" : d.company_id === 3 ? "3" : "auto");
    const notesVal = (d.payload && (d.payload as Record<string, unknown>).notes) as
      | string
      | undefined;
    setNotes(typeof notesVal === "string" ? notesVal : "");
  }, [draftQ.data]);

  const d = draftQ.data;
  const isOwner = !!(d && user && d.created_by === user.id);
  const canEdit = useMemo(() => {
    if (!d) return false;
    if (isAdmin) return true;
    const editable: OrderDraftStatus[] = ["draft", "rejected", "send_failed"];
    return isOwner && editable.includes(d.status);
  }, [d, isAdmin, isOwner]);

  const canSubmitForApproval = !!d && (isOwner || isAdmin) && d.status === "draft";
  const canApprove =
    !!d && isApprover && d.status === "pending_approval" && (!isOwner || isAdmin);
  const canReject = !!d && isApprover && d.status === "pending_approval";
  const canCancel =
    !!d && (isOwner || isAdmin) && (d.status === "draft" || d.status === "rejected");

  async function handleSave() {
    if (!d) return;
    try {
      await update.mutateAsync({
        id: d.id,
        title: title.trim() || null,
        customerName: customerName.trim() || null,
        companyId: company === "auto" ? null : (Number(company) as 1 | 3),
        notes: notes.trim(),
      });
      toast.success("Rascunho atualizado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast.error("Falha ao salvar", { description: msg });
    }
  }

  async function handleTransition(newStatus: OrderDraftStatus, reason?: string) {
    if (!d) return;
    try {
      await transition.mutateAsync({ id: d.id, newStatus, reason });
      toast.success("Status atualizado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast.error("Não foi possível atualizar o status", { description: msg });
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("Informe um motivo");
      return;
    }
    await handleTransition("rejected", rejectReason.trim());
    setRejectOpen(false);
    setRejectReason("");
  }

  if (draftQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!d) {
    return (
      <div className="mx-auto max-w-xl py-8 text-center">
        <p className="text-sm text-muted-foreground">Rascunho não encontrado.</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/orders">Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/orders" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {d.title || d.customer_name_snapshot || "(sem título)"}
          </h1>
          <p className="text-xs text-muted-foreground">ID: {d.id}</p>
          <p className="text-xs text-muted-foreground">
            Criado em {new Date(d.created_at).toLocaleString()} · Atualizado{" "}
            {new Date(d.updated_at).toLocaleString()}
          </p>
        </div>
        <Badge variant="secondary" className="h-fit">{STATUS_LABEL[d.status]}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do rascunho</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select
                value={company}
                onValueChange={(v) => setCompany(v as CompanyChoice)}
                disabled={!canEdit}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automática / não definida</SelectItem>
                  <SelectItem value="1">Graal — ID 1</SelectItem>
                  <SelectItem value="3">Grott — ID 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nº ERP</Label>
              <Input value={d.erp_order_number ?? ""} disabled placeholder="—" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          {d.rejection_reason && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="font-medium text-destructive">Motivo de rejeição</div>
              <div className="text-muted-foreground">{d.rejection_reason}</div>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {canEdit && (
              <Button onClick={handleSave} disabled={update.isPending}>
                {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            )}
            {canSubmitForApproval && (
              <Button
                variant="secondary"
                onClick={() => handleTransition("pending_approval")}
                disabled={transition.isPending}
              >
                Enviar para aprovação
              </Button>
            )}
            {canApprove && (
              <Button onClick={() => handleTransition("approved")} disabled={transition.isPending}>
                Aprovar
              </Button>
            )}
            {canReject && (
              <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">Rejeitar</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Motivo da rejeição</DialogTitle>
                  </DialogHeader>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    placeholder="Descreva o motivo"
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
                    <Button variant="destructive" onClick={handleReject} disabled={transition.isPending}>
                      Confirmar rejeição
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {canCancel && (
              <Button
                variant="outline"
                onClick={() => handleTransition("cancelled")}
                disabled={transition.isPending}
              >
                Cancelar rascunho
              </Button>
            )}
          </div>
          {role === "vendedor" && !canEdit && d.status !== "draft" && (
            <p className="text-xs text-muted-foreground">
              Este rascunho está em status <b>{STATUS_LABEL[d.status]}</b> e não pode ser editado por vendedores.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {eventsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (eventsQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem eventos.</p>
          ) : (
            <ol className="space-y-2">
              {(eventsQ.data ?? []).map((e) => (
                <li key={e.id} className="rounded-md border p-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{e.event_type}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </div>
                  </div>
                  {e.previous_status || e.new_status ? (
                    <div className="text-xs text-muted-foreground">
                      {e.previous_status ? STATUS_LABEL[e.previous_status] : "—"} →{" "}
                      {e.new_status ? STATUS_LABEL[e.new_status] : "—"}
                    </div>
                  ) : null}
                  {e.metadata && (e.metadata as Record<string, unknown>).reason ? (
                    <div className="mt-1 text-xs">
                      Motivo: {String((e.metadata as Record<string, unknown>).reason)}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}