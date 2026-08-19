export type OrderProductGroup =
  | "CHOPP"
  | "GROWLER"
  | "GARRAFA"
  | "OUTROS";

export interface ClassifiableProduct {
  description: string;
  group?: {
    description: string | null;
  } | null;
}

/**
 * Classifica um produto para interface do Wizard baseando-se no grupo e descrição.
 * Regras:
 * 1. Uppercase, sem acentos, trim.
 * 2. GROWLER tem prioridade.
 * 3. GARRAFA tem prioridade sobre CHOPP.
 * 4. CHOPP (ou CHOPE) é o fallback para itens de chopp.
 * 5. Qualquer outro é OUTROS.
 */
export function classifyOrderProduct(product: ClassifiableProduct): OrderProductGroup {
  const normalize = (text: string) => 
    text
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const desc = normalize(product.description || "");
  const groupDesc = product.group?.description ? normalize(product.group.description) : "";

  // Prioridade 1: GROWLER
  if (desc.includes("GROWLER") || groupDesc.includes("GROWLER")) {
    return "GROWLER";
  }

  // Prioridade 2: GARRAFA
  if (desc.includes("GARRAFA") || groupDesc.includes("GARRAFA")) {
    return "GARRAFA";
  }

  // Prioridade 3: CHOPP
  if (
    desc.includes("CHOPP") || 
    desc.includes("CHOPE") || 
    groupDesc.includes("CHOPP") || 
    groupDesc.includes("CHOPE")
  ) {
    return "CHOPP";
  }

  return "OUTROS";
}
