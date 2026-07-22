import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useErpHealth, useListOrdersMutation } from "@/hooks/use-erp";
import { EmptyState } from "@/components/empty-state";
import { CalendarClock, RefreshCcw, Activity, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/operations")({
  head: () => ({
    meta: [
      { title: "Operação do dia — ERP" },
      { name: "description", content: "Acompanhe pedidos de entrega no ERP por data." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OperationsPage,
});

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function OperationsPage() {
  const health = useErpHealth();
  const listMut = useListOrdersMutation();
  const [date, setDate] = useState(todayIso());

  const payload = listMut.data?.data ?? null;
  const orders = (payload?.orders ?? []) as Array<Record<string, unknown>>;
  const count = typeof payload?.count === "number" ? payload.count : orders.length;
  const erpError = listMut.data?.error;

  return (
    <div>
      <PageHeader
        title="Operação do dia"
        description="Consulte as entregas planejadas no ERP por data."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/orders">Ir para pedidos</Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Status do ERP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-muted-foreground" />
              {health.isLoading
                ? "Verificando…"
                : health.isError
                  ? "Indisponível"
                  : String(health.data?.status ?? "OK")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Data consultada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {new Date(date + "T00:00:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Pedidos retornados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {listMut.isPending ? "…" : count}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-col items-start gap-3 p-4 md:flex-row md:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="op-date">Data de entrega</Label>
            <Input
              id="op-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <Button
            onClick={() => listMut.mutate({ date })}
            disabled={listMut.isPending || !date}
          >
            {listMut.isPending ? (
              <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Buscar no ERP
          </Button>
        </CardContent>
      </Card>

      {listMut.isError || erpError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {erpError?.message ??
            (listMut.error instanceof Error
              ? listMut.error.message
              : "Falha ao consultar o ERP.")}
        </div>
      ) : !listMut.data ? (
        <EmptyState
          icon={CalendarClock}
          title="Escolha uma data e consulte o ERP"
          description="Os pedidos com entrega prevista para a data selecionada aparecerão aqui."
        />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Sem pedidos para esta data"
          description="Nenhum pedido de entrega retornou do ERP para a data selecionada."
        />
      ) : (
        <div className="overflow-hidden rounded-md border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Pedido</th>
                <th className="px-3 py-2 text-left font-medium">Cliente</th>
                <th className="px-3 py-2 text-left font-medium">Empresa</th>
                <th className="px-3 py-2 text-left font-medium">Itens</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, idx) => {
                const num =
                  (o.numero as string | number | undefined) ??
                  (o.nPedido as string | number | undefined) ??
                  (o.idOrdensVenda as string | number | undefined) ??
                  "—";
                const customer =
                  (o.clientName as string | undefined) ??
                  (o.customerName as string | undefined) ??
                  "—";
                const cid = o.companyId as number | null | undefined;
                const items = Array.isArray(o.items) ? (o.items as unknown[]).length : "—";
                return (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{String(num)}</td>
                    <td className="px-3 py-2">{customer}</td>
                    <td className="px-3 py-2">
                      {cid === 1 ? "Graal" : cid === 3 ? "Grott" : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{items}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}