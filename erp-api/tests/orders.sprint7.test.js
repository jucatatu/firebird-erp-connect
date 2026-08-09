"use strict";

const request = require("supertest");
const crypto = require("crypto");
const { createApp } = require("../src/app");
const firebird = require("../src/shared/database/firebird-client");
const { _resetForTests } = require("../src/shared/idempotency/idempotency-store");

// Mock de segurança HMAC conforme middleware real
const API_KEY = "test-key-16-chars-min";
const HMAC_SECRET = "test-secret-32-chars-min-at-least-longer";
process.env.API_KEY = API_KEY;
process.env.HMAC_SECRET = HMAC_SECRET;
process.env.IDEMPOTENCY_STORE = "memory";
process.env.NODE_ENV = "test";

function sign(method, path, body, timestamp, nonce, apiKey, secret) {
  const raw = body ? JSON.stringify(body) : "";
  const bodyHash = crypto.createHash("sha256").update(raw).digest("hex");
  const canonical = [method.toUpperCase(), path, timestamp.toString(), nonce, bodyHash].join("\n");
  return crypto.createHmac("sha256", secret).update(canonical).digest("hex");
}

describe("POST /api/v1/orders (Sprint 7 - Atomicidade)", () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    _resetForTests();
    jest.clearAllMocks();
  });

  it("deve executar ROLLBACK se falhar na gravação de itens após o cabeçalho", async () => {
    // 1. Mocks de serviços para permitir chegar na transação
    const clientsService = require("../src/modules/clients/clients.service");
    jest.spyOn(clientsService, "getClientById").mockResolvedValue({ 
      id: 100, address: { city: "Joinville", state: "SC" } 
    });
    
    const productsService = require("../src/modules/products/products.service");
    jest.spyOn(productsService, "getProductById").mockResolvedValue({ id: 1, active: true });
    
    const pricingService = require("../src/modules/pricing/pricing.service");
    jest.spyOn(pricingService, "resolvePrice").mockResolvedValue({ 
      priceFound: true, unitPrice: 10.5, strategy: "fixed" 
    });

    // 2. Mock do Repositório para simular falha no SEGUNDO passo da transação
    const repository = require("../src/modules/orders/orders.repository");
    const callCreateOrderComplete = jest.spyOn(repository, "callCreateOrderComplete").mockResolvedValue(999);
    
    // Simula falha ao adicionar item (Step 7 do service)
    const callAddItem = jest.spyOn(repository, "callAddItem").mockRejectedValue(new Error("DB_ERROR_ON_ITEM"));
    
    // 3. Mock do client firebird para verificar rollback
    const mockTx = {
      query: jest.fn(),
      rollback: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue()
    };
    jest.spyOn(firebird, "withTransaction").mockImplementation(async (fn) => {
      try {
        return await fn(mockTx);
      } catch (e) {
        await mockTx.rollback();
        throw e;
      }
    });

    const timestamp = Date.now();
    const nonce = "test-nonce";
    const body = { 
      companyId: 1, clientId: 100, sellerId: 1, saleTypeId: 1, paymentTermId: 1, paymentMethodId: 1,
      deliver: true, deliveryAt: new Date().toISOString(), returnEquipment: false,
      items: [{ productId: 1, quantity: 1 }] 
    };
    const signature = sign("POST", "/api/v1/orders", body, timestamp, nonce, API_KEY, HMAC_SECRET);

    const res = await request(app)
      .post("/api/v1/orders")
      .send(body)
      .set("x-api-key", API_KEY)
      .set("x-timestamp", timestamp.toString())
      .set("x-nonce", nonce)
      .set("x-signature", signature)
      .set("idempotency-key", "atomic-test-1");

    // Verifica se a API retornou 500
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("ORDER_CREATE_FAILED");

    // PROVA DE ATOMICIDADE:
    // O cabeçalho foi tentado...
    expect(callCreateOrderComplete).toHaveBeenCalled();
    // O item falhou...
    expect(callAddItem).toHaveBeenCalled();
    // O Rollback FOI chamado?
    expect(mockTx.rollback).toHaveBeenCalled();
    // O Commit NÃO foi chamado?
    expect(mockTx.commit).not.toHaveBeenCalled();
  });
});
