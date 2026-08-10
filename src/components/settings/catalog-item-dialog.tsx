import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useCatalogHistory, useUpsertCatalogSetting } from "@/hooks/use-catalog";
import {
  COMPANIES,
  type CatalogItemType,
  type CatalogSetting,
} from "@/lib/catalog/types";

export interface CatalogDialogTarget {
  itemType: CatalogItemType;
  erpItemId: number;
  erpDescription: string;
  erpCode: string | null;
  setting: CatalogSetting | null;
}

const EVENT_LABELS: Record<string, string> = {
  created: "Configuração criada",
  enabled: "Item habilitado",
  disabled: "Item desabilitado",
  updated: "Configuração alterada",
  snapshot_updated: "Descrição do ERP atualizada",
};

export function CatalogItemDialog({
  target,
  onClose,
}: {
  target: CatalogDialogTarget | null;
  onClose: () => void;
}) {
  const upsert = useUpsertCatalogSetting();
  const history = useCatalogHistory(target?.itemType ?? null, target?.erpItemId ?? null);

  const [enabled, setEnabled] = useState(false);
  const [companies, setCompanies] = useState<number[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [defaultQuantity, setDefaultQuantity] = useState("1");
  const [quantityStep, setQuantityStep] = useState("1");
  const [requiresPickup, setRequiresPickup] = useState(false);

  useEffect(() => {
    if (!target) return;
    const s = target.setting;
    setEnabled(s?.enabled ?? false);
    setCompanies(s?.company_ids ?? []);
    setDisplayName(s?.display_name ?? "");
    setSortOrder(String(s?.sort_order ?? 0));
    setDefaultQuantity(String(s?.default_quantity ?? 1));
    setQuantityStep(String(s?.quantity_step ?? 1));
    setRequiresPickup(s?.requires_pickup ?? false);
  }, [target]);

  if (!target) return null;
  const isEquipment = target.itemType === "equipment";

  function toggleCompany(id: number, checked: boolean) {
    setCompanies((prev) =>
      checked ? Array.from(new Set([...prev, id])).sort() : prev.filter((c) => c !== id),
    );
  }

  async function onSave() {
    if (!target) return;
    try {
      await upsert.mutateAsync({
        itemType: target.itemType,
        logisticsType: target.setting?.logistics_type ?? null,
        erpItemId: target.erpItemId,
        erpDescriptionSnapshot: target.erpDescription,
        displayName: displayName.trim() === "" ? null : displayName.trim(),
        enabled,
        companyIds: companies,
        sortOrder: Number(sortOrder),
        defaultQuantity: Number(defaultQuantity),
        quantityStep: Number(quantityStep),
        requiresPickup: isEquipment ? requiresPickup : null,
        expectedVersion: target.setting?.version ?? null,
      });
      toast.success("Configuração salva");
      onClose();
    } catch (err) {
      toast.error("Não foi possível salvar", {
        description: (err as Error)?.message ?? String(err),
      });
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{target.erpDescription}</DialogTitle>
          <DialogDescription>
            {isEquipment ? "Equipamento" : "Produto"} do ERP · ID {target.erpItemId}
            {target.erpCode ? ` · Código ${target.erpCode}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {target.itemType === "product" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Comportamento Logístico</label>
              <select 
                className="w-full p-2 border rounded-md bg-background text-sm"
                value={target.setting?.logistics_type || "packaged"}
                onChange={async (e) => {
                  try {
                    await upsert.mutateAsync({
                      itemType: target.itemType,
                      logisticsType: e.target.value as any,
                      erpItemId: target.erpItemId,
                      erpDescriptionSnapshot: target.erpDescription,
                      displayName: displayName.trim() === "" ? null : displayName.trim(),
                      enabled,
                      companyIds: companies,
                      sortOrder: Number(sortOrder),
                      defaultQuantity: Number(defaultQuantity),
                      quantity_step: Number(quantityStep),
                      requiresPickup: null,
                      expectedVersion: target.setting?.version ?? null,
                    });
                    toast.success("Logística atualizada");
                  } catch (err) {
                    toast.error("Erro ao atualizar logística");
                  }
                }}
              >
                <option value="packaged">Embalado (Lata, Garrafa, Growler)</option>
                <option value="draft">Chopp (Exige Barris / Chopeira Opcional)</option>
              </select>
              <p className="text-[10px] text-muted-foreground">
                Define se o sistema deve exigir equipamentos (barris) para este item.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Disponível no aplicativo</div>
              <p className="text-xs text-muted-foreground">
                O cadastro permanece no ERP; aqui só decidimos o uso no app.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <Label>Empresas</Label>
            <div className="flex gap-4">
              {COMPANIES.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={companies.includes(c.id)}
                    onCheckedChange={(v) => toggleCompany(c.id, v === true)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
            {enabled && companies.length === 0 && (
              <p className="text-xs text-destructive">
                Selecione ao menos uma empresa para habilitar.
              </p>
            )}
          </div>

          {isEquipment && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Exige recolha</div>
                <p className="text-xs text-muted-foreground">
                  Equipamento retornável gera etapa de recolha após a entrega.
                </p>
              </div>
              <Switch checked={requiresPickup} onCheckedChange={setRequiresPickup} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="display-name">Nome de exibição (opcional)</Label>
            <Input
              id="display-name"
              value={displayName}
              maxLength={120}
              placeholder={target.erpDescription}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="default-qty">Qtd. inicial</Label>
              <Input
                id="default-qty"
                type="number"
                min={0.001}
                step="any"
                value={defaultQuantity}
                onChange={(e) => setDefaultQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qty-step">Incremento</Label>
              <Input
                id="qty-step"
                type="number"
                min={0.001}
                step="any"
                value={quantityStep}
                onChange={(e) => setQuantityStep(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort-order">Ordem</Label>
              <Input
                id="sort-order"
                type="number"
                min={0}
                step={1}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div>
            <div className="text-sm font-semibold">Histórico</div>
            {history.isLoading ? (
              <p className="mt-2 text-xs text-muted-foreground">Carregando…</p>
            ) : (history.data ?? []).length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Nenhuma alteração registrada.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {(history.data ?? []).map((e) => (
                  <li key={e.id} className="flex justify-between gap-3 text-xs">
                    <span>{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={upsert.isPending}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={upsert.isPending}>
            {upsert.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}