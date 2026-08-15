"use strict";

require("./helpers/env");

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert");
const repository = require("../src/modules/clients/clients.repository");
const firebird = require("../src/shared/database/firebird-client");

describe("Clients Repository - createClientTransaction Hotfix", () => {
  let mockTx;
  let withTransactionCalled = false;

  beforeEach(() => {
    withTransactionCalled = false;
    mockTx = {
      query: async (sql, params) => {
        if (sql.includes("SP_CAD_CLIENTE_COMPLETO")) {
          return [{ ID: 1234, ID_PES: 5678 }];
        }
        if (sql.includes("SP_CAD_CONTATOS")) {
          return [];
        }
        return [];
      }
    };
  });

  test("deve executar a transação usando o contrato tx.query correto", async (t) => {
    const withTxMock = t.mock.method(firebird, "withTransaction", async (fn) => {
      withTransactionCalled = true;
      return await fn(mockTx);
    });

    const querySpy = t.mock.method(mockTx, "query");

    const clientParams = new Array(34).fill(null);
    const contactParams = [null, "123", "456", "test@test.com", null];

    const result = await repository.createClientTransaction(clientParams, contactParams);

    assert.strictEqual(withTransactionCalled, true, "withTransaction deve ser chamado");
    assert.strictEqual(result.clientId, 1234);
    assert.strictEqual(result.personId, 5678);

    // Validar chamadas
    assert.strictEqual(querySpy.mock.callCount(), 2);
    
    const firstCall = querySpy.mock.calls[0];
    assert.ok(firstCall.arguments[0].includes("SELECT"), "Deve usar SELECT para a SP de cliente");
    assert.ok(firstCall.arguments[0].includes("SP_CAD_CLIENTE_COMPLETO"));
    
    const secondCall = querySpy.mock.calls[1];
    assert.ok(secondCall.arguments[0].includes("SP_CAD_CONTATOS"));
    assert.strictEqual(secondCall.arguments[1][0], 5678, "Deve passar o personId obtido da primeira SP");
  });

  test("deve lançar erro e provocar rollback se a SP de cliente retornar IDs inválidos", async (t) => {
    t.mock.method(firebird, "withTransaction", async (fn) => {
      return await fn({
        query: async () => [{ ID: 0, ID_PES: 0 }] // IDs inválidos
      });
    });

    await assert.rejects(
      repository.createClientTransaction([], []),
      { code: "CLIENT_PROCEDURE_INVALID_RETURN" }
    );
  });
});
