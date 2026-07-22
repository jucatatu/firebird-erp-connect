import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMyRoles } from "@/hooks/use-auth";
import {
  useErpDatabaseHealth,
  useErpHealth,
  useListOrdersMutation,
} from "@/hooks/use-erp";

export const Route = createFileRoute("/_authenticated/settings/erp")({
  head: () => ({
    meta: [
      { title: "Diagnóstico ERP — Firebird Integration" },
      {
        name: "description",
        content:
          "Página interna de diagnóstico da integração com a API Node do ERP Firebird.",
      },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Diagnóstico ERP" },
      {
        property: "og:description",
        content: "Ferramenta interna de validação da API ERP.",
      },
    ],
  }),
  component: ErpDiagnosticsPage,
});

type CompanyChoice = "1" | "3" | "both";

function fmtMoney(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function pick<T = unknown>(obj: unknown, ...keys: string[]): T | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k] as T;
    // case-insensitive fallback
    const found = Object.keys(o).find(
      (x) => x.toLowerCase() === k.toLowerCase(),
    );
    if (found && o[found] !== undefined && o[found] !== null && o[found] !== "")
      return o[found] as T;
  }
  return undefined;
}

function ErrorHint({ code }: { code?: string }) {
  const map: Record<string, string> = {
    ERP_TIMEOUT: "⏱ Timeout — a API não respondeu dentro do prazo.",
    ERP_NETWORK_ERROR:
      "🌐 Servidor indisponível — não foi possível contactar a API.",
    INVALID_SIGNATURE: "🔏 Assinatura HMAC inválida — verifique ERP_HMAC_SECRET.",
    INVALID_API_KEY: "🔑 API_KEY inválida — verifique ERP_API_KEY.",
    UNAUTHORIZED: "🔑 Não autorizado — API_KEY ou HMAC inválidos.",
    ERP_UNAVAILABLE: "🗄 Firebird indisponível — a API não conseguiu conectar ao banco.",
    VALIDATION_ERROR: "⚠ Erro de validação nos parâmetros.",
    HTTP_401: "🔑 Não autorizado (401) — API_KEY ou HMAC.",
    HTTP_403: "🚫 Proibido (403).",
    HTTP_500: "💥 Erro interno da API (500).",
    HTTP_503: "🗄 Serviço indisponível (503) — provavelmente Firebird.",
  };
  if (!code) return null;
  const hint = map[code];
  if (!hint) return null;
  return <p className="mt-1 text-xs text-muted-foreground">{hint}</p>;
}

function StatusCard({
  title,
  loading,
  ok,
  latency,
  children,
}: {
  title: string;
  loading: boolean;
  ok: boolean | null;
  latency?: number;
  children: React.ReactNode;
}) {
  const badge = loading
    ? { label: "…", cls: "bg-muted text-foreground" }
    : ok
    ? { label: "✅ Online", cls: "bg-emerald-500/15 text-emerald-600" }
    : { label: "❌ Falha", cls: "bg-red-500/15 text-red-600" };
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
          {badge.label}
        </span>
      </div>
      {typeof latency === "number" && (
        <p className="mt-1 text-xs text-muted-foreground">
          Latência: {latency} ms
        </p>
      )}
      <div className="mt-3 text-sm">{children}</div>
    </div>
  );
}

function useTimedQuery<T>(startedAt: number | undefined, isFetching: boolean) {
  return useMemo(() => {
    if (!startedAt || isFetching) return undefined;
    return Date.now() - startedAt;
  }, [startedAt, isFetching]);
}

function ErpDiagnosticsPage() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  const rolesQ = useMyRoles(user);
  const isAdmin = (rolesQ.data ?? []).includes("admin");

  const health = useErpHealth();
  const dbHealth = useErpDatabaseHealth();

  const [date, setDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [companyChoice, setCompanyChoice] = useState<CompanyChoice>("both");
  const [showRaw, setShowRaw] = useState(false);

  const orders = useListOrdersMutation();

  const healthLatency = useTimedQuery(
    health.dataUpdatedAt || health.errorUpdatedAt,
    health.isFetching,
  );
  const dbLatency = useTimedQuery(
    dbHealth.dataUpdatedAt || dbHealth.errorUpdatedAt,
    dbHealth.isFetching,
  );

  const healthData = health.data;
  const dbData = dbHealth.data;

  function handleSearch() {
    const companies =
      companyChoice === "both"
        ? undefined
        : ([Number(companyChoice)] as Array<1 | 3>);
    orders.mutate({ date, companies });
  }

  const result = orders.data;
  const ordersList = (result?.ok && result.data?.orders) || [];
  const graalCount = ordersList.filter((o) => Number(pick(o, "companyId")) === 1).length;
  const grottCount = ordersList.filter((o) => Number(pick(o, "companyId")) === 3).length;

  if (!rolesQ.isLoading && !isAdmin) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta página é exclusiva de administradores.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            Diagnóstico ERP
          </h1>
          <p className="text-sm text-muted-foreground">
            Validação da integração entre o Lovable e a API Node do Firebird.
            Uso interno.
          </p>
          <div className="mt-2 rounded border border-border bg-muted/40 px-3 py-1.5 text-xs font-mono text-muted-foreground">
            Build: 3a45e8f · Commit: 3a45e8fe220c1368a2380d4804225584efdd0d92 · Timestamp: 2026-07-21T23:51Z
          </div>
        </header>

        {/* Status */}
        <section className="grid gap-4 md:grid-cols-2">
          <StatusCard
            title="1. Status da API"
            loading={health.isFetching}
            ok={health.isSuccess && (healthData?.ok ?? false)}
            latency={healthLatency}
          >
            {health.isSuccess && healthData?.ok ? (
              <ul className="space-y-1 text-muted-foreground">
                <li>
                  <span className="text-foreground">Serviço:</span>{" "}
                  {String(healthData.data?.service ?? "—")}
                </li>
                <li>
                  <span className="text-foreground">Versão:</span>{" "}
                  {String(healthData.data?.version ?? "—")}
                </li>
                <li>
                  <span className="text-foreground">Ambiente:</span>{" "}
                  {String(healthData.data?.environment ?? "—")}
                </li>
                <li>
                  <span className="text-foreground">Timestamp:</span>{" "}
                  {String(healthData.data?.timestamp ?? "—")}
                </li>
              </ul>
            ) : (
              <div className="text-red-600">
                <p>
                  {healthData?.error?.message ??
                    health.error?.message ??
                    "Falha na conexão."}
                </p>
                <ErrorHint code={healthData?.error?.code} />
              </div>
            )}
            <button
              onClick={() => health.refetch()}
              className="mt-3 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
            >
              Recarregar
            </button>
          </StatusCard>

          <StatusCard
            title="2. Status do Firebird"
            loading={dbHealth.isFetching}
            ok={dbHealth.isSuccess && (dbData?.ok ?? false)}
            latency={dbLatency}
          >
            {dbHealth.isSuccess && dbData?.ok ? (
              <ul className="space-y-1 text-muted-foreground">
                <li>
                  <span className="text-foreground">Status:</span>{" "}
                  {String(dbData.data?.status ?? "—")}
                </li>
                <li>
                  <span className="text-foreground">Database:</span>{" "}
                  {String(dbData.data?.database ?? "—")}
                </li>
                <li>
                  <span className="text-foreground">Timestamp:</span>{" "}
                  {String(dbData.data?.timestamp ?? "—")}
                </li>
              </ul>
            ) : (
              <div className="text-red-600">
                <p>
                  {dbData?.error?.message ??
                    dbHealth.error?.message ??
                    "Falha na conexão com o Firebird."}
                </p>
                <ErrorHint code={dbData?.error?.code} />
                {dbData?.status ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    HTTP {dbData.status} · code {dbData.error?.code ?? "—"}
                  </p>
                ) : null}
              </div>
            )}
            <button
              onClick={() => dbHealth.refetch()}
              className="mt-3 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
            >
              Recarregar
            </button>
          </StatusCard>
        </section>

        {/* Teste de listagem */}
        <section className="mt-6 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">
            3. Teste de listagem de pedidos
          </h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs text-muted-foreground">
              Data
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col text-xs text-muted-foreground">
              Empresa
              <select
                value={companyChoice}
                onChange={(e) => setCompanyChoice(e.target.value as CompanyChoice)}
                className="mt-1 rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
              >
                <option value="both">Ambas</option>
                <option value="1">Graal (1)</option>
                <option value="3">Grott (3)</option>
              </select>
            </label>
            <button
              onClick={handleSearch}
              disabled={orders.isPending || !date}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {orders.isPending ? "Buscando…" : "Buscar pedidos"}
            </button>
          </div>

          {/* Resultado */}
          {orders.isError && (
            <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
              <p className="font-semibold">Erro ao chamar a API</p>
              <p>{(orders.error as Error)?.message}</p>
            </div>
          )}

          {result && !result.ok && (
            <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
              <p className="font-semibold">
                {result.error?.code ?? `HTTP_${result.status}`}
              </p>
              <p>{result.error?.message}</p>
              <ErrorHint code={result.error?.code} />
            </div>
          )}

          {result && result.ok && (
            <div className="mt-4">
              <div className="mb-3 flex flex-wrap gap-4 text-sm">
                <div className="rounded bg-muted px-3 py-2">
                  <span className="text-muted-foreground">Total:</span>{" "}
                  <strong>{result.data?.count ?? ordersList.length}</strong>
                </div>
                <div className="rounded bg-muted px-3 py-2">
                  <span className="text-muted-foreground">Graal (1):</span>{" "}
                  <strong>{graalCount}</strong>
                </div>
                <div className="rounded bg-muted px-3 py-2">
                  <span className="text-muted-foreground">Grott (3):</span>{" "}
                  <strong>{grottCount}</strong>
                </div>
              </div>

              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Número</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Empresa</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersList.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-6 text-center text-muted-foreground"
                        >
                          Nenhum pedido encontrado.
                        </td>
                      </tr>
                    )}
                    {ordersList.map((o, idx) => {
                      const num = pick(o, "orderNumber", "numero", "N_PEDIDO");
                      const customer =
                        pick(o, "clientName", "customerName", "cliente", "nome") ?? "—";
                      const cid = Number(pick(o, "companyId"));
                      const empresa =
                        cid === 1 ? "Graal" : cid === 3 ? "Grott" : "—";
                      // Total do pedido = soma de items[].total (payload não expõe total top-level).
                      const items = (pick<unknown[]>(o, "items") ?? []) as Array<
                        Record<string, unknown>
                      >;
                      const total =
                        pick(o, "total", "valorTotal", "VALOR_TOTAL") ??
                        pick(o, "valor") ??
                        (Array.isArray(items)
                          ? items.reduce(
                              (acc, it) => acc + (Number(pick(it, "total", "valorItem")) || 0),
                              0,
                            )
                          : undefined);
                      const dt =
                        pick(
                          o,
                          "expectedDelivery",
                          "deliveryDate",
                          "dataEntrega",
                          "DATA_PREV_ENTREGA",
                        ) ?? pick(o, "date", "data");
                      return (
                        <tr
                          key={String(pick(o, "id", "orderId") ?? idx)}
                          className="border-t border-border"
                        >
                          <td className="px-3 py-2 font-mono">{String(num ?? "—")}</td>
                          <td className="px-3 py-2">{String(customer)}</td>
                          <td className="px-3 py-2">{empresa}</td>
                          <td className="px-3 py-2 text-right">{fmtMoney(total)}</td>
                          <td className="px-3 py-2">{String(dt ?? "—")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Debug */}
          {result && (
            <div className="mt-4">
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="rounded border border-border px-3 py-1 text-xs hover:bg-accent"
              >
                {showRaw ? "Ocultar JSON bruto" : "Mostrar JSON bruto"}
              </button>
              {showRaw && (
                <pre className="mt-2 max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </div>
          )}
        </section>

        <p className="mt-6 text-xs text-muted-foreground">
          Página de diagnóstico interna — não integrada ao fluxo de produção.
        </p>
      </div>
    </div>
  );
}
