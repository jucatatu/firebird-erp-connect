import { describe, it, expect } from "vitest";
import { formatSupabaseError } from "../error-formatter";

describe("formatSupabaseError", () => {
  it("should format catalog_reorder_conflict with details and hint", () => {
    const error = {
      message: "catalog_reorder_conflict",
      details: "Item count mismatch (snapshot is stale).",
      hint: "Refresh the page and try again."
    };
    const formatted = formatSupabaseError(error);
    expect(formatted).toContain("Conflito ao salvar a ordem");
    expect(formatted).toContain("Detalhe: Item count mismatch (snapshot is stale).");
    expect(formatted).toContain("Hint: Refresh the page and try again.");
  });

  it("should not mention 'outro administrador' genericamente if not proven", () => {
    const error = {
      message: "catalog_reorder_conflict"
    };
    const formatted = formatSupabaseError(error);
    // Verificamos se a mensagem base foi atualizada
    expect(formatted).toContain("Conflito ao salvar a ordem. O catálogo mudou desde a última leitura.");
    expect(formatted).not.toContain("alterado por outro administrador");
  });
});
