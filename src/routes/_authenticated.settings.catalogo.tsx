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
  const [query, setQuery] = useState<string>("");
  const productsQ = useErpProducts({ q: query, limit: 50, isAdminSearch: true, companyId: 1 });
  const payload = (productsQ.data as any)?.ok ? (productsQ.data as any).data : null;
  const apiError = productsQ.data && !(productsQ.data as any).ok ? (productsQ.data as any).error : null;

  const configuredProducts = useMemo(() => {
    return Array.from(settingsByKey.values()).filter(s => s.item_type === 'product');
  }, [settingsByKey]);

  return (
    <div>
      <div className="space-y-4">
        {/* Seção: Produtos Configurados */}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Produtos configurados no catálogo</h3>
          <div className="space-y-2">
            {configuredProducts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground border rounded-md border-dashed">
                Nenhum produto configurado para esta empresa.
              </p>
            ) : (
              configuredProducts.map((setting) => (
                <button
                  key={`conf-${setting.id}`}
                  type="button"
                  onClick={() =>
                    onSelect({
                      itemType: "product",
                      erpItemId: setting.erp_item_id,
                      erpDescription: setting.erp_description_snapshot,
                      erpCode: null, // Será carregado pelo ERP se necessário
                      setting: setting,
                    })
                  }
                  className="flex w-full items-center justify-between gap-3 rounded-md border bg-surface p-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {setting.display_name || setting.erp_description_snapshot}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      ID {setting.erp_item_id}
                    </div>
                  </div>
                  <StatusBadges setting={setting} />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="mb-2 text-sm font-semibold">Buscar novo produto no ERP</h3>
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
              placeholder="Digite ao menos 3 caracteres (ex: Pil)"
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
              <p className="text-sm text-muted-foreground">Nenhum produto encontrado no ERP.</p>
            )}
            {(Array.isArray(payload?.products) ? payload.products : []).map((p: any) => {
              const id = Number(p.id);
              if (!Number.isInteger(id) || id <= 0) return null;
              const description = p.description?.trim() || `Produto ${id}`;
              const setting = settingsByKey.get(settingKey("product", id));
              
              // Se já está configurado, opcionalmente podemos destacar ou apenas permitir editar
              return (
                <button
                  key={`erp-${id}`}
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
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {setting && <Badge variant="outline" className="text-[10px]">Já no catálogo</Badge>}
                    <StatusBadges setting={setting} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
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
  const equipQ = useErpEquipmentTypes({ isAdminSearch: true, companyId: 1 });
  const payload = (equipQ.data as any)?.ok ? (equipQ.data as any).data : null;
  const apiError = equipQ.data && !(equipQ.data as any).ok ? (equipQ.data as any).error : null;

  const list = useMemo(() => {
    const rawList = payload && typeof payload === 'object' && 'equipmentTypes' in payload 
      ? (payload.equipmentTypes as ErpEquipmentType[]) 
      : (Array.isArray(payload) ? (payload as ErpEquipmentType[]) : []);
    
    const t = term.trim().toLowerCase();
    if (t === "") return rawList;
    return rawList.filter((e: ErpEquipmentType) =>
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
        {list.map((e: any) => {
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