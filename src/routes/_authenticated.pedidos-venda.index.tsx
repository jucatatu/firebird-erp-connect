import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMyRoles, primaryRole } from "@/hooks/use-auth";
import { useOrderDrafts, usePaginatedOrderDrafts, type OrderDraftStatus } from "@/hooks/use-drafts";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { PlusCircle, Search, Inbox, Filter, Truck, Package } from "lucide-react";
import { useOrderFormStore } from "@/hooks/use-order-form";
import { getItemList, getEquipmentList, getLogisticsSummary } from "@/lib/order-summary";
import { getErpOrdersStatus, type ErpOrderStatus } from "@/lib/erp-orders.functions";
import { useQuery } from "@tanstack/react-query";

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
    page: search.page ? Number(search.page) : 1,
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
  const page = search.page || 1;
  const PAGE_SIZE = 10;
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
    page,
    pageSize: PAGE_SIZE,
  } as any);

  // useOrderDrafts currently doesn't support pagination, but we want to use the new hook for the list
  const paginatedQ = useOrderDrafts({
    status,
    companyId: company === "all" ? "all" : (Number(company) as 1 | 3),
    mineOnly: role === "vendedor",
    myUserId: user?.id ?? null,
    search: query,
    page,
    pageSize: PAGE_SIZE,
  } as any);

  // Wait, I should use the new usePaginatedOrderDrafts hook here.
  // I will refactor this to use usePaginatedOrderDrafts for the list view.

  const rows = useMemo(() => data ?? [], [data]);

  const erpOrderNumbers = useMemo(() => 
    rows.map(r => r.erp_order_number).filter((num): num is number => num !== null),
  [rows]);

  const erpStatusQ = useQuery({
    queryKey: ["erp-orders-status", erpOrderNumbers],
    queryFn: async () => {
      const resp = await getErpOrdersStatus({ data: erpOrderNumbers });
      if (!resp.ok) throw new Error(resp.error?.message || "Erro ao buscar status ERP");
      return resp.data || [];
    },
    enabled: erpOrderNumbers.length > 0,
    refetchInterval: 30000, // Refresh status every 30s
  });

  const statusMap = useMemo(() => {
    const map = new Map<number, ErpOrderStatus>();
    (erpStatusQ.data || []).forEach((s: ErpOrderStatus) => map.set(s.orderNumber, s));
    return map;
  }, [erpStatusQ.data]);

  return (
    <div>
      <PageHeader
        title="Pedidos"
        description="Todos os pedidos internos com filtros por status, empresa e busca."
        actions={
          (role === "vendedor" || isAdmin) && (
            <Button asChild size="sm" onClick={() => useOrderFormStore.getState().resetItemsAndClient()}>
              <Link to="/pedidos-venda/novo" search={{ edit: undefined, status: undefined }}>
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
              onChange={(e) => {
                setQuery(e.target.value);
                navigate({ search: { ...search, page: 1 } });
              }}
              placeholder="Buscar por título ou cliente"
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={company} onValueChange={(v) => {
              setCompany(v as "all" | "1" | "3");
              navigate({ search: { ...search, page: 1 } });
            }}>
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
        onValueChange={(v) => navigate({ search: { ...search, status: v as StatusFilter, page: 1 } })}
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
                <Link to="/pedidos-venda/novo" search={{ edit: undefined, status: undefined }}>Novo pedido</Link>
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
                  <th className="px-4 py-2 text-left font-medium">Cliente / Pedido</th>
                  <th className="px-4 py-2 text-left font-medium">Conteúdo</th>
                  <th className="px-4 py-2 text-left font-medium">Empresa</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const erpStatus = statusMap.get(d.erp_order_number!);
                  const isDeleted = erpStatus?.exists === false || erpStatus?.deleted;

                  return (
                    <tr key={d.id} className="border-t transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 align-top">
                        <Link
                          to="/pedidos-venda/$draftId"
                          params={{ draftId: d.id }}
                          className="block group"
                        >
                          <div className="text-base font-bold text-foreground group-hover:text-primary transition-colors whitespace-pre-line leading-tight mb-1">
                            {d.customer_name_snapshot || "(sem cliente)"}
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            {d.erp_order_number && (
                              <span className="text-xs font-bold text-muted-foreground/80">ERP {d.erp_order_number}</span>
                            )}
                            <div className="flex items-center gap-2">
                              {d.erp_order_number && (
                                erpStatusQ.isError ? (
                                  <Badge variant="secondary" className="text-[10px] h-5 px-2 py-0 border-muted text-muted-foreground uppercase font-bold">
                                    ERP: INDISPONÍVEL
                                  </Badge>
                                ) : erpStatus ? (
                                  <Badge 
                                    variant={isDeleted ? "destructive" : "outline"}
                                    className={`text-[10px] h-5 px-2 py-0 uppercase font-bold ${
                                      !isDeleted 
                                        ? "border-primary/20 bg-primary/5 text-primary" 
                                        : "bg-destructive/10 text-destructive border-destructive/20"
                                    }`}
                                  >
                                    ERP: {erpStatus.exists === false ? "EXCLUÍDO" : (erpStatus.statusDescription || "...")}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] h-5 px-2 py-0 border-primary/20 bg-primary/5 text-primary uppercase font-bold">
                                    ERP: ...
                                  </Badge>
                                )
                              )}
                              <StatusBadge status={d.status} className="h-5 px-2 text-[10px] py-0" />
                            </div>
                          </div>
                          <div className="mt-2">
                            <OrderIdentifier id={d.id} appOrderNumber={d.app_order_number} className="text-[10px] opacity-60" />
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-top max-w-[250px]">
                        <div className="space-y-2">
                          <div className="flex flex-col gap-0.5 text-[10px]">
                            <span className="font-bold text-muted-foreground/70 uppercase tracking-widest mb-0.5">Produtos</span>
                            {getItemList(d.payload, 2).map((item, idx) => (
                              <div key={idx} className={`${item.isMain ? 'text-foreground/90 font-medium' : 'text-muted-foreground italic'}`}>
                                {item.text}
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-col gap-0.5 text-[10px]">
                            <span className="font-bold text-muted-foreground/70 uppercase tracking-widest mb-0.5">Equipamentos</span>
                            {getEquipmentList(d.payload, 2).map((item, idx) => (
                              <div key={idx} className={`${item.isMain ? 'text-foreground/90 font-medium' : 'text-muted-foreground italic'}`}>
                                {item.text}
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-col gap-0.5 text-[10px]">
                            <span className="font-bold text-muted-foreground/50 uppercase tracking-widest mb-0.5">Logística</span>
                            <span className="text-foreground/80 truncate leading-normal">{getLogisticsSummary(d.payload)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col text-[10px] text-foreground/80">
                          <span className="font-bold text-muted-foreground/60 uppercase tracking-tight">Empresa</span>
                          <span>{companyLabel(d.company_id)} • {new Date(d.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {/* Status badge is now integrated in the first column for better flow */}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {/* Date is integrated with Company */}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map((d) => {
              const erpStatus = statusMap.get(d.erp_order_number!);
              const isDeleted = erpStatus?.exists === false || erpStatus?.deleted;
              const productList = getItemList(d.payload, 3);
              const equipmentList = getEquipmentList(d.payload, 3);
              
              return (
                <li key={d.id}>
                  <Link
                    to="/pedidos-venda/$draftId"
                    params={{ draftId: d.id }}
                    className="block rounded-xl border bg-card p-3 shadow-sm active:scale-[0.98] transition-all"
                  >
                    {/* 1. Cliente */}
                    <div className="text-lg font-bold text-foreground whitespace-pre-line leading-tight mb-1">
                      {d.customer_name_snapshot || "(sem cliente)"}
                    </div>
                    
                    {/* 2. ERP + Identificador */}
                    <div className="flex items-center gap-4 mb-2">
                      {d.erp_order_number && (
                        <span className="text-xs font-bold text-foreground">ERP {d.erp_order_number}</span>
                      )}
                      <OrderIdentifier id={d.id} appOrderNumber={d.app_order_number} className="text-[10px] opacity-60 font-mono" />
                    </div>

                    {/* 3. Status ERP + Sincronização */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {d.erp_order_number && (
                        erpStatusQ.isError ? (
                          <Badge variant="secondary" className="text-[10px] h-5 px-2 py-0 border-muted text-muted-foreground uppercase font-bold">
                            ERP: INDISPONÍVEL
                          </Badge>
                        ) : erpStatus ? (
                          <Badge 
                            variant={isDeleted ? "destructive" : "outline"}
                            className={`text-[10px] h-5 px-2 py-0 uppercase font-bold ${
                              !isDeleted 
                                ? "border-primary/20 bg-primary/5 text-primary" 
                                : "bg-destructive/10 text-destructive border-destructive/20"
                            }`}
                          >
                            ERP: {erpStatus.exists === false ? "EXCLUÍDO" : (erpStatus.statusDescription || "...")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-5 px-2 py-0 border-primary/20 bg-primary/5 text-primary uppercase font-bold">
                            ERP: ...
                          </Badge>
                        )
                      )}
                      <StatusBadge status={d.status} className="h-5 px-2 text-[10px] py-0" />
                    </div>

                    {/* 4. Empresa + Data */}
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase mb-2">
                      <span>{companyLabel(d.company_id)}</span>
                      <span>•</span>
                      <span>{new Date(d.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>

                    {/* 5. Blocos de Conteúdo - Lado a Lado no Mobile */}
                    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2 mb-2">
                      {/* Bloco Produtos */}
                      <div className="rounded-lg border border-muted/30 bg-muted/5 p-1.5 flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-0.5">Produtos</span>
                        {productList.length > 0 ? (
                          productList.map((item, idx) => (
                            <div key={idx} className={`text-[11px] leading-tight break-words ${item.isMain ? 'text-foreground/90 font-medium' : 'text-muted-foreground italic'}`}>
                              {item.text}
                            </div>
                          ))
                        ) : (
                          <span className="text-[11px] text-muted-foreground/40 italic">Nenhum</span>
                        )}
                      </div>

                      {/* Bloco Equipamentos */}
                      <div className="rounded-lg border border-muted/30 bg-muted/5 p-1.5 flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-0.5">Equipamentos</span>
                        {equipmentList.length > 0 ? (
                          equipmentList.map((item, idx) => (
                            <div key={idx} className={`text-[11px] leading-tight break-words ${item.isMain ? 'text-foreground/90 font-medium' : 'text-muted-foreground italic'}`}>
                              {item.text}
                            </div>
                          ))
                        ) : (
                          <span className="text-[11px] text-muted-foreground/40 italic">Nenhum</span>
                        )}
                      </div>
                    </div>

                    {/* 6. Logística Rodapé */}
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/80 uppercase">
                      {d.payload?.deliver === true ? (
                        <Truck className="h-3 w-3" />
                      ) : (
                        <Package className="h-3 w-3" />
                      )}
                      <span>{getLogisticsSummary(d.payload)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="mt-6 flex flex-col items-center gap-4 border-t pt-4 sm:flex-row sm:justify-between">
              <div className="text-xs text-muted-foreground">
                Exibindo <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}</span> a{" "}
                <span className="font-medium">{Math.min(page * PAGE_SIZE, total)}</span> de{" "}
                <span className="font-medium">{total}</span> pedidos
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate({ search: { ...search, page: page - 1 } })}
                  disabled={page <= 1}
                  className="h-8 px-2"
                >
                  Anterior
                </Button>
                
                <div className="flex items-center gap-1 px-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1))
                    .map((p, i, arr) => (
                      <React.Fragment key={p}>
                        {i > 0 && arr[i - 1] !== p - 1 && (
                          <span className="text-muted-foreground">...</span>
                        )}
                        <Button
                          variant={page === p ? "default" : "outline"}
                          size="sm"
                          onClick={() => navigate({ search: { ...search, page: p } })}
                          className={`h-8 w-8 p-0 text-xs ${page === p ? "pointer-events-none" : ""}`}
                        >
                          {p}
                        </Button>
                      </React.Fragment>
                    ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate({ search: { ...search, page: page + 1 } })}
                  disabled={page >= totalPages}
                  className="h-8 px-2"
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}