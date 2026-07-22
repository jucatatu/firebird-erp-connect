import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMyRoles, primaryRole } from "@/hooks/use-auth";
import { useOrderDrafts, type OrderDraftStatus } from "@/hooks/use-drafts";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Pedidos — ERP" },
      { name: "description", content: "Lista de rascunhos de pedidos internos." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OrdersListPage,
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

function OrdersListPage() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  const rolesQ = useMyRoles(user);
  const role = primaryRole(rolesQ.data);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderDraftStatus | "all">("all");
  const [companyId, setCompanyId] = useState<"1" | "3" | "all">("all");
  const [mineOnly, setMineOnly] = useState(false);

  useEffect(() => {
    if (role === "vendedor") setMineOnly(true);
  }, [role]);

  const drafts = useOrderDrafts({
    status,
    companyId: companyId === "all" ? "all" : (Number(companyId) as 1 | 3),
    mineOnly,
    myUserId: user?.id ?? null,
    search,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Rascunhos e envios ao ERP.</p>
        </div>
        <Button asChild>
          <Link to="/orders/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Novo pedido
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label>Buscar</Label>
              <Input
                placeholder="Título ou cliente"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as OrderDraftStatus | "all")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {(Object.keys(STATUS_LABEL) as OrderDraftStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empresa</Label>
              <Select value={companyId} onValueChange={(v) => setCompanyId(v as "1" | "3" | "all")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="1">Graal (1)</SelectItem>
                  <SelectItem value="3">Grott (3)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role !== "vendedor" && (
              <div className="flex items-end gap-2">
                <Checkbox
                  id="mine"
                  checked={mineOnly}
                  onCheckedChange={(v) => setMineOnly(Boolean(v))}
                />
                <Label htmlFor="mine" className="mb-2">Somente meus pedidos</Label>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {drafts.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : drafts.isError ? (
            <p className="text-sm text-destructive">Não foi possível carregar.</p>
          ) : (drafts.data ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum rascunho encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2">Título / Cliente</th>
                    <th className="py-2 pr-2">Empresa</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Nº ERP</th>
                    <th className="py-2 pr-2">Atualizado</th>
                    <th className="py-2 pr-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {(drafts.data ?? []).map((d) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        <div className="font-medium">{d.title || "(sem título)"}</div>
                        <div className="text-xs text-muted-foreground">
                          {d.customer_name_snapshot || "—"}
                        </div>
                      </td>
                      <td className="py-2 pr-2">{d.company_id ?? "—"}</td>
                      <td className="py-2 pr-2">
                        <Badge variant="secondary">{STATUS_LABEL[d.status]}</Badge>
                      </td>
                      <td className="py-2 pr-2">{d.erp_order_number ?? "—"}</td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">
                        {new Date(d.updated_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/orders/$draftId" params={{ draftId: d.id }}>Abrir</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}