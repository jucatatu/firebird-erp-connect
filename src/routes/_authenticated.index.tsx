import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMyRoles, primaryRole, type AppRole } from "@/hooks/use-auth";
import {
  useDraftStats,
  useOrderDrafts,
  type OrderDraftStatus,
  type OrderDraftRow,
} from "@/hooks/use-drafts";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { OrderIdentifier, companyLabel } from "@/components/order-identifier";
import {
  PlusCircle,
  ClipboardList,
  ShieldCheck,
  Wrench,
  Inbox,
  ArrowRight,
  Activity,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Central de operação — Pedidos ERP" },
      { name: "description", content: "Painel operacional interno de pedidos." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: HomePage,
});

type Attention = { key: string; label: string; count: number; to: string; tone: "warn" | "info" | "danger" };

function attentionFor(role: AppRole | null, drafts: OrderDraftRow[] | undefined): Attention[] {
  if (!drafts) return [];
  const by = (s: OrderDraftStatus) => drafts.filter((d) => d.status === s).length;
  if (role === "aprovador") {
    return [
      { key: "pending", label: "Aguardando sua aprovação", count: by("pending_approval"), to: "/approvals", tone: "warn" },
    ];
  }
  if (role === "admin") {
    return [
      { key: "pending", label: "Aguardando aprovação", count: by("pending_approval"), to: "/approvals", tone: "warn" },
      { key: "failed", label: "Falhas no envio ao ERP", count: by("send_failed"), to: "/orders?status=send_failed", tone: "danger" },
      { key: "rejected", label: "Rejeitados a revisar", count: by("rejected"), to: "/orders?status=rejected", tone: "info" },
    ];
  }
  return [
    { key: "draft", label: "Meus rascunhos abertos", count: by("draft"), to: "/orders?status=draft", tone: "info" },
    { key: "rejected", label: "Rejeitados para corrigir", count: by("rejected"), to: "/orders?status=rejected", tone: "warn" },
    { key: "failed", label: "Falhas no envio", count: by("send_failed"), to: "/orders?status=send_failed", tone: "danger" },
  ];
}

function toneClasses(t: Attention["tone"]) {
  if (t === "danger") return "border-status-failed-fg/40 bg-status-failed-bg/50";
  if (t === "warn") return "border-status-pending-fg/40 bg-status-pending-bg/50";
  return "border-border bg-surface";
}

function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const rolesQ = useMyRoles(user);
  const role = primaryRole(rolesQ.data);
  const isAdmin = (rolesQ.data ?? []).includes("admin");
  const stats = useDraftStats({ role, myUserId: user?.id ?? null });

  const scope = role === "vendedor" ? { mineOnly: true, myUserId: user?.id ?? null } : undefined;
  const drafts = useOrderDrafts(scope);
  const attention = attentionFor(role, drafts.data);

  const recentDrafts = (drafts.data ?? []).slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Central de operação"
        description="Visão consolidada dos pedidos internos e da integração com o ERP."
        actions={
          <>
            {(role === "vendedor" || isAdmin) && (
              <Button asChild size="sm">
                <Link to="/orders/new">
                  <PlusCircle className="mr-2 h-4 w-4" /> Novo pedido
                </Link>
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <Link to="/orders">
                <ClipboardList className="mr-2 h-4 w-4" /> Ver pedidos
              </Link>
            </Button>
          </>
        }
      />

      {/* Precisa de atenção */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground/80">Precisa de atenção</h2>
        {attention.every((a) => a.count === 0) ? (
          <EmptyState
            icon={Inbox}
            title="Tudo em dia"
            description="Nenhuma ação pendente para você agora."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attention.map((a) => (
              <Link
                key={a.key}
                to={a.to}
                className={
                  "group rounded-lg border p-4 transition-colors hover:border-primary/60 " +
                  toneClasses(a.tone)
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {a.label}
                    </div>
                    <div className="mt-2 text-3xl font-semibold tabular-nums">
                      {a.count}
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Resumo por status */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground/80">Resumo por status</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {(
            [
              { s: "draft", label: role === "vendedor" ? "Meus rascunhos" : "Rascunhos" },
              { s: "pending_approval", label: "Aguardando" },
              { s: "approved", label: "Aprovados" },
              { s: "sent", label: "Enviados" },
              { s: "send_failed", label: "Falhas" },
            ] as const
          ).map((c) => (
            <Card key={c.s} className="border-border/80">
              <CardHeader className="pb-1">
                <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  {stats.isLoading ? "…" : stats.data?.[c.s as OrderDraftStatus] ?? 0}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Atalhos */}
      {isAdmin && (
        <section className="mb-8 grid gap-3 md:grid-cols-2">
          <Link
            to="/settings/erp"
            className="flex items-center gap-3 rounded-lg border bg-surface p-4 transition-colors hover:border-primary/50"
          >
            <div className="grid h-10 w-10 place-items-center rounded-md bg-muted">
              <Wrench className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Integração ERP</div>
              <div className="text-xs text-muted-foreground">Diagnóstico e verificação de conectividade.</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            to="/approvals"
            className="flex items-center gap-3 rounded-lg border bg-surface p-4 transition-colors hover:border-primary/50"
          >
            <div className="grid h-10 w-10 place-items-center rounded-md bg-muted">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Fila de aprovações</div>
              <div className="text-xs text-muted-foreground">Pedidos aguardando revisão.</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </section>
      )}

      {/* Atividade recente */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground/80">Atividade recente</h2>
          <Button asChild size="sm" variant="ghost">
            <Link to="/orders">Ver todos</Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            {drafts.isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
            ) : recentDrafts.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Nenhum pedido ainda"
                description="A atividade mais recente aparecerá aqui."
                action={
                  (role === "vendedor" || isAdmin) && (
                    <Button asChild size="sm">
                      <Link to="/orders/new">Criar primeiro pedido</Link>
                    </Button>
                  )
                }
                className="border-0"
              />
            ) : (
              <ul className="divide-y">
                {recentDrafts.map((d) => (
                  <li key={d.id}>
                    <Link
                      to="/orders/$draftId"
                      params={{ draftId: d.id }}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <OrderIdentifier id={d.id} />
                          <span className="text-[11px] text-muted-foreground">
                            · {companyLabel(d.company_id)}
                          </span>
                        </div>
                        <div className="truncate text-sm font-medium">
                          {d.title || d.customer_name_snapshot || "(sem título)"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Atualizado {new Date(d.updated_at).toLocaleString()}
                        </div>
                      </div>
                      <StatusBadge status={d.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}