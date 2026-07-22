import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase client antes de importar o service.
const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } } }),
    },
  },
}));

import { LocalOrderOperationService } from "../OrderOperationService";
import { OperationConflictError } from "../types";

beforeEach(() => rpcMock.mockReset());

describe("OrderOperationService", () => {
  it("transition chama apply_operation_transition com os parâmetros esperados", async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ id: "s1", version: 2 }], error: null });
    await LocalOrderOperationService.transition({
      stateId: "s1",
      action: "start_delivery",
      expectedVersion: 1,
      payload: { note: "ok" },
    });
    expect(rpcMock).toHaveBeenCalledWith("apply_operation_transition", {
      _state_id: "s1",
      _action: "start_delivery",
      _expected_version: 1,
      _payload: { note: "ok" },
    });
  });

  it("assignOperator chama assign_operation_operator", async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ id: "s1", version: 2 }], error: null });
    await LocalOrderOperationService.assignOperator({
      stateId: "s1",
      role: "delivery",
      userId: "u9",
      expectedVersion: 1,
    });
    expect(rpcMock).toHaveBeenCalledWith("assign_operation_operator", {
      _state_id: "s1",
      _role: "delivery",
      _user_id: "u9",
      _expected_version: 1,
    });
  });

  it("NÃO expõe applyStatus nem reschedule (RPCs antigas removidas)", () => {
    const svc = LocalOrderOperationService as unknown as Record<string, unknown>;
    expect(svc.applyStatus).toBeUndefined();
    expect(svc.reschedule).toBeUndefined();
  });

  it("NUNCA chama apply_operation_status nem reschedule_operation", async () => {
    rpcMock.mockResolvedValue({ data: [{ id: "s1", version: 2 }], error: null });
    await LocalOrderOperationService.transition({
      stateId: "s1",
      action: "reschedule_delivery",
      expectedVersion: 1,
      payload: { newDate: "2026-08-15", reason: "cliente pediu" },
    });
    for (const call of rpcMock.mock.calls) {
      expect(call[0]).not.toBe("apply_operation_status");
      expect(call[0]).not.toBe("reschedule_operation");
    }
  });

  it("conflito de versão vira OperationConflictError", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "P0004", message: "operation_state_conflict" },
    });
    await expect(
      LocalOrderOperationService.transition({
        stateId: "s1",
        action: "start_delivery",
        expectedVersion: 1,
      }),
    ).rejects.toBeInstanceOf(OperationConflictError);
  });
});