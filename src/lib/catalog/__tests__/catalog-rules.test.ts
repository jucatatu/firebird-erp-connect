import { describe, expect, it } from "vitest";
import {
  companyLabels,
  translateCatalogError,
  validateDraft,
  type CatalogSettingDraft,
} from "../types";

function draft(over: Partial<CatalogSettingDraft> = {}): CatalogSettingDraft {
  return {
    itemType: "product",
    erpItemId: 10,
    erpDescriptionSnapshot: "CHOPP PILSEN 50L",
    displayName: null,
    enabled: true,
    companyIds: [1],
    sortOrder: 0,
    defaultQuantity: 1,
    quantityStep: 1,
    requiresPickup: null,
    expectedVersion: null,
    ...over,
  };
}

describe("validateDraft", () => {
  it("aceita produto válido", () => {
    expect(validateDraft(draft())).toBeNull();
  });

  it("recusa habilitar sem empresa", () => {
    expect(validateDraft(draft({ companyIds: [] }))).toMatch(/empresa/i);
  });

  it("permite desabilitado sem empresa", () => {
    expect(validateDraft(draft({ enabled: false, companyIds: [] }))).toBeNull();
  });

  it("recusa produto com recolha", () => {
    expect(validateDraft(draft({ requiresPickup: true }))).toMatch(/recolha/i);
  });

  it("exige definição de recolha em equipamento habilitado", () => {
    expect(
      validateDraft(draft({ itemType: "equipment", requiresPickup: null })),
    ).toMatch(/recolha/i);
  });

  it("aceita equipamento com recolha definida", () => {
    expect(
      validateDraft(draft({ itemType: "equipment", requiresPickup: false })),
    ).toBeNull();
  });

  it("recusa empresa fora do domínio", () => {
    expect(validateDraft(draft({ companyIds: [2] }))).toMatch(/Graal e Grott/);
  });

  it("recusa quantidades não positivas", () => {
    expect(validateDraft(draft({ defaultQuantity: 0 }))).toMatch(/Quantidade/i);
    expect(validateDraft(draft({ quantityStep: -1 }))).toMatch(/Incremento/i);
  });

  it("recusa item do ERP inválido", () => {
    expect(validateDraft(draft({ erpItemId: 0 }))).toMatch(/ERP/);
  });
});

describe("companyLabels", () => {
  it("formata empresas", () => {
    expect(companyLabels([1, 3])).toBe("Graal · Grott");
    expect(companyLabels([])).toBe("—");
  });
});

describe("translateCatalogError", () => {
  it("traduz conflito de versão", () => {
    expect(translateCatalogError("catalog_setting_conflict")).toMatch(/Recarregue/);
  });
  it("traduz permissão", () => {
    expect(translateCatalogError("forbidden")).toMatch(/administradores/i);
  });
  it("mantém mensagem desconhecida", () => {
    expect(translateCatalogError("boom")).toBe("boom");
  });
});