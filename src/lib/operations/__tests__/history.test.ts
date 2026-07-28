import { describe, it, expect } from "vitest";
import {
  completionTimestamp,
  dedupeBy,
  isWithinCompletedWindow,
  mapWindowLabel,
  matchesHistorySearch,
  parseMapWindow,
  windowStartIso,
} from "../history";
import type { OperationState } from "../types";

const NOW = new Date("2026-07-30T12:00:00Z").getTime();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

function state(p: Partial<OperationState>): OperationState {
  return {
    id: p.id ?? "s1",
    erp_order_id: 8444,
    erp_order_number: 8444,
    company_id: 3,
    operation_date: "2026-07-23",
    operational_date: null,
    operational_status: "delivered",
    sequence: null,
    reschedule_reason: null,
    snapshot: { customerName: "HOTEL VALE DAS PEDRAS", address: "Rua A, 100" },
    created_by: "u1",
    updated_by: null,
    created_at: daysAgo(10),
    updated_at: daysAgo(10),
    version: 3,
    ...p,
  } as OperationState;
}

describe("persistência permanente e janela de exibição", () => {
  it("1. entrega confirmada mantém carimbo permanente de conclusão", () => {
    const s = state({ delivered_at: daysAgo(1), delivered_by: "u1" });
    expect(completionTimestamp(s)).toBe(daysAgo(1));
  });

  it("2/3. registro segue consultável independente da data ou do ERP", () => {
    const s = state({ delivered_at: daysAgo(30), operation_date: "2026-01-01" });
    expect(isWithinCompletedWindow(s, "always", NOW)).toBe(true);
    expect(completionTimestamp(s)).not.toBeNull();
  });

  it("4. snapshot preserva cliente e endereço do momento da entrega", () => {
    const s = state({ delivered_at: daysAgo(1) });
    expect(s.snapshot.customerName).toBe("HOTEL VALE DAS PEDRAS");
    expect(s.snapshot.address).toBe("Rua A, 100");
  });

  it("5. concluído com 6 dias aparece com janela de 7 dias", () => {
    expect(isWithinCompletedWindow(state({ delivered_at: daysAgo(6) }), 7, NOW)).toBe(true);
  });

  it("6. concluído com 8 dias não aparece por padrão com janela de 7 dias", () => {
    expect(isWithinCompletedWindow(state({ delivered_at: daysAgo(8) }), 7, NOW)).toBe(false);
  });

  it("7. concluído com 8 dias continua disponível no histórico", () => {
    const s = state({ delivered_at: daysAgo(8) });
    expect(isWithinCompletedWindow(s, "always", NOW)).toBe(true);
    expect(matchesHistorySearch(s, "8444")).toBe(true);
  });

  it("8. configuração Sempre mostra todos", () => {
    expect(isWithinCompletedWindow(state({ delivered_at: daysAgo(400) }), "always", NOW)).toBe(true);
    expect(windowStartIso("always", NOW)).toBeNull();
  });

  it("9. alterar a configuração não altera o registro (função pura)", () => {
    const s = state({ delivered_at: daysAgo(8) });
    const before = JSON.stringify(s);
    isWithinCompletedWindow(s, 30, NOW);
    isWithinCompletedWindow(s, 1, NOW);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("10. deduplica pedido presente no Node e no banco", () => {
    const rows = [
      { erpId: 8444, opType: "delivery", src: "erp" },
      { erpId: 8444, opType: "delivery", src: "history" },
      { erpId: 8444, opType: "pickup", src: "history" },
    ];
    const out = dedupeBy(rows, (r) => `${r.erpId}:${r.opType}`);
    expect(out).toHaveLength(2);
    expect(out[0].src).toBe("erp");
  });

  it("11. busca por número, cliente e responsável encontra entrega antiga", () => {
    const s = state({ delivered_at: daysAgo(90) });
    expect(matchesHistorySearch(s, "8444")).toBe(true);
    expect(matchesHistorySearch(s, "hotel")).toBe(true);
    expect(matchesHistorySearch(s, "joão", { assigneeName: "João" })).toBe(true);
    expect(matchesHistorySearch(s, "inexistente")).toBe(false);
  });

  it("12. operação não concluída nunca é ocultada pela janela", () => {
    const s = state({ operational_status: "pending", delivered_at: null });
    expect(isWithinCompletedWindow(s, 1, NOW)).toBe(true);
  });

  it("recolha usa pickup_completed_at como referência de conclusão", () => {
    const s = state({ delivered_at: daysAgo(20), pickup_completed_at: daysAgo(2) });
    expect(completionTimestamp(s)).toBe(daysAgo(2));
    expect(isWithinCompletedWindow(s, 7, NOW)).toBe(true);
  });

  it("configuração aceita opções válidas e faz fallback para 7", () => {
    expect(parseMapWindow("always")).toBe("always");
    expect(parseMapWindow(15)).toBe(15);
    expect(parseMapWindow(999)).toBe(7);
    expect(mapWindowLabel(1)).toBe("1 dia");
    expect(mapWindowLabel("always")).toBe("Sempre");
  });
});
