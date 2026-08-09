import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthSession, useMyRoles } from "@/hooks/use-auth";
import { useErpEquipmentTypes, useErpProducts } from "@/hooks/use-erp";
import { ErpEquipmentType } from "@/lib/erp-orders.functions";
import { useCatalogSettings } from "@/hooks/use-catalog";
import {
  CatalogItemDialog,
  type CatalogDialogTarget,
} from "@/components/settings/catalog-item-dialog";
import { companyLabels, type CatalogSetting } from "@/lib/catalog/types";

export const Route = createFileRoute("/_authenticated/settings/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo de pedidos — Configuração" },
      {
        name: "description",
        content:
          "Defina quais produtos e equipamentos do ERP ficam disponíveis para criação de pedidos no aplicativo.",
      },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Catálogo de pedidos" },
      {
        property: "og:description",
        content: "Configuração de produtos e equipamentos disponíveis no aplicativo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CatalogSettingsPage,
});

function settingKey(type: string, id: number) {
  return `${type}:${id}`;
}

function StatusBadges({ setting }: { setting: CatalogSetting | undefined }) {
  if (!setting) {
    return <Badge variant="outline">Não configurado</Badge>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={setting.enabled ? "default" : "secondary"}>
        {setting.enabled ? "Disponível" : "Indisponível"}
      </Badge>
      <Badge variant="outline">{companyLabels(setting.company_ids)}</Badge>
      {setting.requires_pickup && <Badge variant="outline">Exige recolha</Badge>}
    </div>
  );
}

function CatalogSettingsPage() {
  const { user } = useAuthSession();
  const { data: roles, isLoading: rolesLoading } = useMyRoles(user);
  const isAdmin = (roles ?? []).includes("admin");

  const settingsQ = useCatalogSettings();
  const settingsByKey = useMemo(() => {
    const map = new Map<string, CatalogSetting>();
    for (const s of settingsQ.data ?? []) map.set(settingKey(s.item_type, s.erp_item_id), s);
    return map;
  }, [settingsQ.data]);

  const [target, setTarget] = useState<CatalogDialogTarget | null>(null);

  if (rolesLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
        <PageHeader
          title="Catálogo de pedidos"
          description="Somente administradores podem configurar o catálogo."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-4 md:p-6">
      <PageHeader
        title="Catálogo de pedidos"
        description="O ERP continua sendo a fonte oficial dos cadastros. Aqui você decide o que aparece no aplicativo."
      />

      <Tabs defaultValue="products" className="mt-4">
        <TabsList>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="equipment">Equipamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <ProductsTab settingsByKey={settingsByKey} onSelect={setTarget} />
        </TabsContent>

        <TabsContent value="equipment" className="mt-4">
          <EquipmentTab settingsByKey={settingsByKey} onSelect={setTarget} />
        </TabsContent>
      </Tabs>

      <CatalogItemDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function ProductsTab({
  settingsByKey,
  onSelect,
}: {
  settingsByKey: Map<string, CatalogSetting>;
  onSelect: (t: CatalogDialogTarget) => void;
}) {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const productsQ = useErpProducts(query ? { q: query, limit: 50 } : null);
  const payload = productsQ.data?.ok ? productsQ.data.data : null;
  const apiError = productsQ.data && !productsQ.data.ok ? productsQ.data.error : null;

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(term.trim());
        }}
      >
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por descrição ou código (mín. 3 caracteres)"
          aria-label="Buscar produtos no ERP"
        />
        <Button type="submit" disabled={term.trim().length < 3}>
          <Search className="h-4 w-4" />
          Buscar
        </Button>
      </form>

      <div className="mt-4 space-y-2">
        {productsQ.isFetching && (
          <p className="text-sm text-muted-foreground">Consultando o ERP…</p>
        )}
        {productsQ.error && (
          <p className="text-sm text-destructive">
            {(productsQ.error as Error).message}
          </p>
        )}
        {apiError && <p className="text-sm text-destructive">{apiError.message}</p>}
        {!productsQ.isFetching && query && payload && payload.products.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
        )}
        {!query && (
          <p className="text-sm text-muted-foreground">
            Busque um produto no ERP para configurá-lo.
          </p>
        )}
        {(payload?.products ?? []).map((p) => {
          const id = Number(p.id);
          if (!Number.isInteger(id) || id <= 0) return null;
          const description = p.description?.trim() || `Produto ${id}`;
          const setting = settingsByKey.get(settingKey("product", id));
          return (
            <button
              key={id}
              type="button"
              onClick={() =>
                onSelect({
                  itemType: "product",
                  erpItemId: id,
                  erpDescription: description,
                  erpCode: p.code ?? null,
                  setting: setting ?? null,
                })
              }
              className="flex w-full items-center justify-between gap-3 rounded-md border bg-surface p-3 text-left transition-colors hover:bg-accent"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {setting?.display_name || description}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  ID {id}
                  {p.code ? ` · ${p.code}` : ""}
                  {p.unit?.description ? ` · ${p.unit.description}` : ""}
                </div>
              </div>
              <StatusBadges setting={setting} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EquipmentTab({
  settingsByKey,
  onSelect,
}: {
  settingsByKey: Map<string, CatalogSetting>;
  onSelect: (t: CatalogDialogTarget) => void;
}) {
  const [term, setTerm] = useState("");
  const equipQ = useErpEquipmentTypes();
  const payload = equipQ.data?.ok ? equipQ.data.data : null;
  const apiError = equipQ.data && !equipQ.data.ok ? equipQ.data.error : null;

  const list = useMemo(() => {
    const all = (payload as unknown as ErpEquipmentType[]) || [];
    const t = term.trim().toLowerCase();
    if (t === "") return all;
    return all.filter((e: ErpEquipmentType) =>
      `${e.description ?? ""} ${e.code ?? ""}`.toLowerCase().includes(t),
    );
  }, [payload, term]);

  return (
    <div>
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Filtrar equipamentos"
        aria-label="Filtrar equipamentos"
      />

      <div className="mt-4 space-y-2">
        {equipQ.isLoading && (
          <p className="text-sm text-muted-foreground">Consultando o ERP…</p>
        )}
        {equipQ.error && (
          <p className="text-sm text-destructive">{(equipQ.error as Error).message}</p>
        )}
        {apiError && <p className="text-sm text-destructive">{apiError.message}</p>}
        {!equipQ.isLoading && list.length === 0 && !apiError && (
          <p className="text-sm text-muted-foreground">Nenhum equipamento encontrado.</p>
        )}
        {list.map((e: ErpEquipmentType) => {
          const id = Number(e.id);
          if (!Number.isInteger(id) || id <= 0) return null;
          const description = e.description?.trim() || `Equipamento ${id}`;
          const setting = settingsByKey.get(settingKey("equipment", id));
          return (
            <button
              key={id}
              type="button"
              onClick={() =>
                onSelect({
                  itemType: "equipment",
                  erpItemId: id,
                  erpDescription: description,
                  erpCode: e.code ?? null,
                  setting: setting ?? null,
                })
              }
              className="flex w-full items-center justify-between gap-3 rounded-md border bg-surface p-3 text-left transition-colors hover:bg-accent"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {setting?.display_name || description}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  ID {id}
                  {e.code ? ` · ${e.code}` : ""}
                </div>
              </div>
              <StatusBadges setting={setting} />
            </button>
          );
        })}
      </div>
    </div>
  );
}