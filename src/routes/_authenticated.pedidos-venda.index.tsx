import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMyRoles, primaryRole } from "@/hooks/use-auth";
import { useOrderDrafts, type OrderDraftStatus } from "@/hooks/use-drafts";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { OrderIdentifier, companyLabel } from "@/components/order-identifier";
import { EmptyState } from "@/components/empty-state";
import { PlusCircle, Search, Inbox, Filter } from "lucide-react";
import { useOrderFormStore } from "@/hooks/use-order-form";
import { getItemsSummary, getEquipmentsSummary } from "@/lib/order-summary";

type StatusFilter = OrderDraftStatus | "all";

export const Route = createFileRoute("/_authenticated/pedidos-venda/")({
  head: () => ({
    meta: [
      { title: "Pedidos — ERP" },
      { name: "description", content: "Lista operacional de pedidos internos." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    status: (search.status as StatusFilter | undefined) ?? "all",
  }),
  component: OrdersListPage,
});

const TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "draft", label: "Rascunhos" },
  { key: "pending_approval", label: "Aguardando" },
  { key: "approved", label: "Aprovados" },
  { key: "sent", label: "Enviados" },
  { key: "send_failed", label: "Falhas" },
  { key: "rejected", label: "Rejeitados" },
];

function OrdersListPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  const rolesQ = useMyRoles(user);
  const role = primaryRole(rolesQ.data);
  const isAdmin = (rolesQ.data ?? []).includes("admin");

  const [company, setCompany] = useState<"all" | "1" | "3">("all");
  const [query, setQuery] = useState("");

  const status: StatusFilter = search.status ?? "all";

  const { data, isLoading, isError } = useOrderDrafts({
    status,
    companyId: company === "all" ? "all" : (Number(company) as 1 | 3),
    mineOnly: role === "vendedor",
    myUserId: user?.id ?? null,
    search: query,
  });

  const rows = useMemo(() => data ?? [], [data]);

  return (
    <div>
      <PageHeader
        title="Pedidos"
        description="Todos os pedidos internos com filtros por status, empresa e busca."
        actions={
          (role === "vendedor" || isAdmin) && (
            <Button asChild size="sm" onClick={() => useOrderFormStore.getState().resetItemsAndClient()}>
              <Link to="/pedidos-venda/novo">
                <PlusCircle className="mr-2 h-4 w-4" /> Novo pedido
              </Link>
            </Button>
          )
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título ou cliente"
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={company} onValueChange={(v) => setCompany(v as "all" | "1" | "3")}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas empresas</SelectItem>
                <SelectItem value="1">Graal (1)</SelectItem>
                <SelectItem value="3">Grott (3)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={status}
        onValueChange={(v) => navigate({ search: { status: v as StatusFilter } })}
      >
        <TabsList className="mb-4 flex w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className="rounded-full border bg-surface px-3 py-1 text-xs data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="rounded-md border bg-surface p-6 text-sm text-muted-foreground">
          Carregando…
        </div>
      ) : isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          Não foi possível carregar os pedidos.
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhum pedido encontrado"
          description="Ajuste os filtros ou crie um novo pedido."
          action={
            (role === "vendedor" || isAdmin) && (
              <Button asChild size="sm">
                <Link to="/pedidos-venda/novo">Novo pedido</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-md border bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Identificação</th>
                  <th className="px-4 py-2 text-left font-medium">Cliente</th>
                  <th className="px-4 py-2 text-left font-medium">Empresa</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-t transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2 align-top">
                      <Link
                        to="/pedidos-venda/$draftId"
                        params={{ draftId: d.id }}
                        className="block"
                      >
                        <OrderIdentifier id={d.id} />
                        <div className="mt-0.5 truncate text-sm font-medium text-foreground">
                          {d.title || "(sem título)"}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-2 align-top text-foreground/90">
                      {d.customer_name_snapshot || "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-foreground/80">
                      {companyLabel(d.company_id)}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-muted-foreground">
                      {new Date(d.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {rows.map((d) => (
              <li key={d.id}>
                <Link
                  to="/pedidos-venda/$draftId"
                  params={{ draftId: d.id }}
                  className="block rounded-md border bg-surface p-3"
                >
                  <div className="flex items-center justify-between">
                    <OrderIdentifier id={d.id} />
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="mt-1 truncate text-sm font-medium">
                    {d.title || d.customer_name_snapshot || "(sem título)"}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {companyLabel(d.company_id)} · {new Date(d.updated_at).toLocaleDateString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}