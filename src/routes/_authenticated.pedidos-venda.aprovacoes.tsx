import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMyRoles } from "@/hooks/use-auth";
import { useOrderDrafts, useTransitionDraft } from "@/hooks/use-drafts";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { OrderIdentifier, companyLabel } from "@/components/order-identifier";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ShieldCheck, Inbox } from "lucide-react";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Fila de aprovações — ERP" },
      { name: "description", content: "Pedidos aguardando revisão e decisão." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  const rolesQ = useMyRoles(user);
  const roles = rolesQ.data ?? [];
  const canApprove = roles.includes("aprovador") || roles.includes("admin");
  const isAdmin = roles.includes("admin");

  const list = useOrderDrafts({ status: "pending_approval" });
  const transition = useTransitionDraft();

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  if (!rolesQ.isLoading && !canApprove) {
    return (
      <div>
        <PageHeader title="Fila de aprovações" />
        <EmptyState
          icon={ShieldCheck}
          title="Acesso restrito"
          description="Esta área é destinada a aprovadores e administradores."
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/">Voltar</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const rows = list.data ?? [];

  async function approve(id: string) {
    try {
      await transition.mutateAsync({ id, newStatus: "approved" });
      toast.success("Pedido aprovado");
    } catch (err) {
      toast.error("Falha ao aprovar", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  async function confirmReject() {
    if (!rejectId) return;
    if (!reason.trim()) {
      toast.error("Informe o motivo");
      return;
    }
    try {
      await transition.mutateAsync({
        id: rejectId,
        newStatus: "rejected",
        reason: reason.trim(),
      });
      toast.success("Pedido rejeitado");
      setRejectId(null);
      setReason("");
    } catch (err) {
      toast.error("Falha ao rejeitar", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  return (
    <div>
      <PageHeader
        title="Fila de aprovações"
        description="Pedidos aguardando decisão de um aprovador."
      />

      {list.isLoading ? (
        <div className="rounded-md border bg-surface p-6 text-sm text-muted-foreground">
          Carregando…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Fila vazia"
          description="Nenhum pedido aguardando aprovação no momento."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((d) => {
            const isOwn = d.created_by === user?.id;
            const cannotApprove = isOwn && !isAdmin;
            return (
              <li key={d.id}>
                <Card>
                  <CardContent className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <OrderIdentifier id={d.id} />
                        <StatusBadge status={d.status} />
                        <span className="text-xs text-muted-foreground">
                          · {companyLabel(d.company_id)}
                        </span>
                      </div>
                      <Link
                        to="/orders/$draftId"
                        params={{ draftId: d.id }}
                        className="mt-1 block truncate text-sm font-medium hover:underline"
                      >
                        {d.title || d.customer_name_snapshot || "(sem título)"}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Cliente: {d.customer_name_snapshot || "—"} · Enviado{" "}
                        {new Date(d.updated_at).toLocaleString()}
                      </div>
                      {cannotApprove && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Você é o autor — apenas administradores podem aprovar seu próprio pedido.
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/orders/$draftId" params={{ draftId: d.id }}>
                          Ver detalhe
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRejectId(d.id);
                          setReason("");
                        }}
                        disabled={transition.isPending}
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approve(d.id)}
                        disabled={transition.isPending || cannotApprove}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!rejectId} onOpenChange={(v) => !v && setRejectId(null)}>
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ar-reason">Motivo</Label>
            <Textarea
              id="ar-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              O motivo será registrado no histórico e visível ao autor.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmReject} disabled={transition.isPending}>
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}