import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Loader2, Search, ArrowUpDown, Check, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthSession, useMyRoles } from "@/hooks/use-auth";
import { useErpEquipmentTypes, useErpProducts } from "@/hooks/use-erp";
import { ErpEquipmentType } from "@/lib/erp-orders.functions";
import { useCatalogSettings, useReorderCatalogItems } from "@/hooks/use-catalog";
import {
  CatalogItemDialog,
  type CatalogDialogTarget,
} from "@/components/settings/catalog-item-dialog";
import { companyLabels, type CatalogSetting } from "@/lib/catalog/types";
import { CatalogReorderList } from "@/components/settings/catalog-reorder-list";
import { classifyOrderProduct } from "@/utils/order-product-group";
import { hasOrderChanged } from "@/utils/catalog-reorder-utils";

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
      {setting.item_type === "product" && (
        <Badge variant="outline" className={setting.logistics_type === 'draft' ? "bg-amber-50 text-amber-700 border-amber-200" : ""}>
          {setting.logistics_type === 'draft' ? "Logística: Chopp" : "Logística: Embalado"}
        </Badge>
      )}
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
  const productsQ = useErpProducts({ q: query, limit: 50, isAdminSearch: true });
  const payload = (productsQ.data as any)?.ok ? (productsQ.data as any).data : null;
  const apiError = productsQ.data && !(productsQ.data as any).ok ? (productsQ.data as any).error : null;

  const [isOrdering, setIsOrdering] = useState(false);
  const reorderMutation = useReorderCatalogItems();

  const configuredProducts = useMemo(() => {
    return Array.from(settingsByKey.values())
      .filter(s => s.item_type === 'product')
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [settingsByKey]);

  const [localOrder, setLocalOrder] = useState<CatalogSetting[]>([]);

  useEffect(() => {
    if (isOrdering) {
      setLocalOrder(configuredProducts);
    }
  }, [isOrdering, configuredProducts]);

  const groupedProducts = useMemo(() => {
    const list = isOrdering ? localOrder : configuredProducts;
    
    const groups = {
      CHOPP: [] as CatalogSetting[],
      GROWLER: [] as CatalogSetting[],
      GARRAFA: [] as CatalogSetting[],
      OUTROS: [] as CatalogSetting[],
    };

    list.forEach(s => {
      const category = classifyOrderProduct({
        description: s.erp_description_snapshot,
      });
      groups[category].push(s);
    });

    return groups;
  }, [isOrdering, localOrder, configuredProducts]);

  const hasChanged = useMemo(() => {
    const originalIds = configuredProducts.map(s => s.id);
    const currentIds = localOrder.map(s => s.id);
    return hasOrderChanged(originalIds, currentIds);
  }, [configuredProducts, localOrder]);

  const handleSave = async () => {
    try {
      await reorderMutation.mutateAsync({
        itemType: 'product',
        orderedIds: localOrder.map(s => s.id),
        expectedVersions: localOrder.map(s => s.version),
      });
      toast.success("Ordem dos produtos atualizada com sucesso.");
      setIsOrdering(false);
    } catch (err: any) {
      if (err.message === "catalog_reorder_conflict") {
        toast.error("O catálogo foi alterado por outro administrador. Recarregue antes de salvar.");
      } else {
        toast.error("Erro ao salvar ordem", { description: err.message });
      }
    }
  };

  const updateGroupOrder = (category: keyof typeof groupedProducts, newGroupItems: CatalogSetting[]) => {
    setLocalOrder(prev => {
      const next = [...prev];
      // Substitui os itens daquela categoria no array flat preservando a posição relativa dos grupos
      // Regra de flatten: CHOPP > GROWLER > GARRAFA > OUTROS
      const result: CatalogSetting[] = [];
      const categories: (keyof typeof groupedProducts)[] = ['CHOPP', 'GROWLER', 'GARRAFA', 'OUTROS'];
      
      categories.forEach(cat => {
        if (cat === category) {
          result.push(...newGroupItems);
        } else {
          result.push(...groupedProducts[cat]);
        }
      });
      return result;
    });
  };

  return (
    <div>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Produtos configurados no catálogo</h3>
            {!isOrdering ? (
              configuredProducts.length > 1 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsOrdering(true)}
                  className="h-8 gap-1.5"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Ordenar
                </Button>
              )
            ) : (
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsOrdering(false)}
                  className="h-8 gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleSave}
                  disabled={!hasChanged || reorderMutation.isPending}
                  className="h-8 gap-1.5"
                >
                  {reorderMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Salvar ordem
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {configuredProducts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground border rounded-md border-dashed">
                Nenhum produto configurado para esta empresa.
              </p>
            ) : (
              (['CHOPP', 'GROWLER', 'GARRAFA', 'OUTROS'] as const).map(category => {
                const items = groupedProducts[category];
                if (items.length === 0 && !isOrdering) return null;
                if (items.length === 0 && isOrdering) return null; // Ocultar grupos vazios mesmo em ordenação

                return (
                  <div key={category} className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
                      {category}
                    </h4>
                    {isOrdering ? (
                      <CatalogReorderList 
                        items={items} 
                        onReorder={(newItems) => updateGroupOrder(category, newItems)} 
                      />
                    ) : (
                      <div className="space-y-2">
                        {items.map((setting) => (
                          <button
                            key={`conf-${setting.id}`}
                            type="button"
                            onClick={() =>
                              onSelect({
                                itemType: "product",
                                erpItemId: setting.erp_item_id,
                                erpDescription: setting.erp_description_snapshot,
                                erpCode: null,
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
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {!isOrdering && (
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
        )}
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
  const equipQ = useErpEquipmentTypes({ isAdminSearch: true });
  const payload = (equipQ.data as any)?.ok ? (equipQ.data as any).data : null;
  const apiError = equipQ.data && !(equipQ.data as any).ok ? (equipQ.data as any).error : null;

  const [isOrdering, setIsOrdering] = useState(false);
  const reorderMutation = useReorderCatalogItems();

  const configuredEquipments = useMemo(() => {
    return Array.from(settingsByKey.values())
      .filter(s => s.item_type === 'equipment')
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [settingsByKey]);

  const [localOrder, setLocalOrder] = useState<CatalogSetting[]>([]);

  useEffect(() => {
    if (isOrdering) {
      setLocalOrder(configuredEquipments);
    }
  }, [isOrdering, configuredEquipments]);

  const hasChanged = useMemo(() => {
    const originalIds = configuredEquipments.map(s => s.id);
    const currentIds = localOrder.map(s => s.id);
    return hasOrderChanged(originalIds, currentIds);
  }, [configuredEquipments, localOrder]);

  const handleSave = async () => {
    try {
      await reorderMutation.mutateAsync({
        itemType: 'equipment',
        orderedIds: localOrder.map(s => s.id),
        expectedVersions: localOrder.map(s => s.version),
      });
      toast.success("Ordem dos equipamentos atualizada com sucesso.");
      setIsOrdering(false);
    } catch (err: any) {
      if (err.message === "catalog_reorder_conflict") {
        toast.error("O catálogo foi alterado por outro administrador. Recarregue antes de salvar.");
      } else {
        toast.error("Erro ao salvar ordem", { description: err.message });
      }
    }
  };

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
      {!isOrdering ? (
        <>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Filtrar equipamentos"
                className="pl-9"
              />
            </div>
            {configuredEquipments.length > 1 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsOrdering(true)}
                className="h-10 gap-1.5"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                Ordenar
              </Button>
            )}
          </div>

          <div className="space-y-2">
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
                  <div className="flex items-center gap-2">
                    {setting && <Badge variant="outline" className="text-[10px]">Já no catálogo</Badge>}
                    <StatusBadges setting={setting} />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Ordenar equipamentos configurados</h3>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsOrdering(false)}
                className="h-8 gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleSave}
                disabled={!hasChanged || reorderMutation.isPending}
                className="h-8 gap-1.5"
              >
                {reorderMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Salvar ordem
              </Button>
            </div>
          </div>
          <CatalogReorderList 
            items={localOrder} 
            onReorder={setLocalOrder} 
          />
        </div>
      )}
    </div>
  );
}
