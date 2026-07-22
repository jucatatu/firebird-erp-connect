import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMyRoles, primaryRole } from "@/hooks/use-auth";
import { useDraftStats, useOrderDrafts, type OrderDraftStatus } from "@/hooks/use-drafts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Início — Pedidos ERP" },
      { name: "description", content: "Painel inicial do sistema interno de pedidos." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: HomePage,
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

function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const rolesQ = useMyRoles(user);
  const role = primaryRole(rolesQ.data);
  const stats = useDraftStats({ role, myUserId: user?.id ?? null });
  const recent = useOrderDrafts(
    role === "vendedor"
      ? { mineOnly: true, myUserId: user?.id ?? null }
      : undefined,
  );

  const cards: { key: OrderDraftStatus; label: string }[] = [
    { key: "draft", label: role === "vendedor" ? "Meus rascunhos" : "Rascunhos" },
    { key: "pending_approval", label: "Aguardando aprovação" },
    { key: "approved", label: "Aprovados" },
    { key: "sent", label: "Enviados" },
    { key: "send_failed", label: "Falha no envio" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
          <p className="text-sm text-muted-foreground">Visão geral dos pedidos internos.</p>
        </div>
        <Button asChild>
          <Link to="/orders/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo pedido
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {stats.isLoading ? "…" : stats.data?.[c.key] ?? 0}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedidos recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : recent.isError ? (
            <p className="text-sm text-destructive">Não foi possível carregar.</p>
          ) : (recent.data ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">Nenhum rascunho ainda.</p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/orders/new">Criar primeiro pedido</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {(recent.data ?? []).slice(0, 8).map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <Link
                      to="/orders/$draftId"
                      params={{ draftId: d.id }}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {d.title || d.customer_name_snapshot || "(sem título)"}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {new Date(d.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <Badge variant="secondary">{STATUS_LABEL[d.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}