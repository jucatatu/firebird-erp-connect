export type CatalogItemType = "product" | "equipment";

export interface CatalogSetting {
  id: string;
  item_type: CatalogItemType;
  erp_item_id: number;
  erp_description_snapshot: string;
  display_name: string | null;
  enabled: boolean;
  company_ids: number[];
  sort_order: number;
  default_quantity: number;
  quantity_step: number;
  requires_pickup: boolean | null;
  version: number;
  updated_at: string;
}

export interface CatalogSettingDraft {
  itemType: CatalogItemType;
  erpItemId: number;
  erpDescriptionSnapshot: string;
  displayName: string | null;
  enabled: boolean;
  companyIds: number[];
  sortOrder: number;
  defaultQuantity: number;
  quantityStep: number;
  requiresPickup: boolean | null;
  expectedVersion: number | null;
}

export const COMPANIES: Array<{ id: 1 | 3; label: string }> = [
  { id: 1, label: "Graal" },
  { id: 3, label: "Grott" },
];

export function companyLabels(ids: number[]): string {
  if (!ids || ids.length === 0) return "—";
  return COMPANIES.filter((c) => ids.includes(c.id))
    .map((c) => c.label)
    .join(" · ");
}

/**
 * Validação espelhada da RPC. O banco é a fonte da verdade; isto apenas
 * evita ida ao servidor com dados inválidos.
 */
export function validateDraft(d: CatalogSettingDraft): string | null {
  if (!Number.isInteger(d.erpItemId) || d.erpItemId <= 0) return "Item do ERP inválido.";
  const snap = d.erpDescriptionSnapshot.trim();
  if (snap === "" || snap.length > 300) return "Descrição do ERP inválida.";
  if (d.displayName !== null && d.displayName.trim().length > 120)
    return "Nome de exibição deve ter no máximo 120 caracteres.";
  if (d.companyIds.some((c) => c !== 1 && c !== 3)) return "Empresas permitidas: Graal e Grott.";
  if (d.enabled && d.companyIds.length === 0)
    return "Para habilitar o item, selecione ao menos uma empresa.";
  if (!(d.defaultQuantity > 0)) return "Quantidade inicial deve ser maior que zero.";
  if (!(d.quantityStep > 0)) return "Incremento deve ser maior que zero.";
  if (!Number.isInteger(d.sortOrder) || d.sortOrder < 0) return "Ordem de exibição inválida.";
  if (d.itemType === "product" && d.requiresPickup !== null)
    return "Produto nunca exige recolha.";
  if (d.itemType === "equipment" && d.enabled && d.requiresPickup === null)
    return "Defina se o equipamento exige recolha.";
  return null;
}

const RPC_ERRORS: Record<string, string> = {
  forbidden: "Somente administradores podem alterar o catálogo.",
  not_authenticated: "Sessão expirada. Entre novamente.",
  catalog_setting_conflict:
    "Outro administrador alterou este item. Recarregue e tente novamente.",
  product_cannot_require_pickup: "Produto nunca exige recolha.",
  equipment_requires_pickup_definition: "Defina se o equipamento exige recolha.",
  enabled_requires_company: "Para habilitar o item, selecione ao menos uma empresa.",
  invalid_company_ids: "Empresas permitidas: Graal e Grott.",
  invalid_default_quantity: "Quantidade inicial inválida.",
  invalid_quantity_step: "Incremento inválido.",
  invalid_sort_order: "Ordem de exibição inválida.",
  invalid_display_name: "Nome de exibição inválido.",
  invalid_snapshot: "Descrição do ERP inválida.",
};

export function translateCatalogError(message: string | undefined | null): string {
  const raw = (message ?? "").trim();
  for (const [key, text] of Object.entries(RPC_ERRORS)) {
    if (raw.includes(key)) return text;
  }
  return raw || "Não foi possível salvar a configuração.";
}