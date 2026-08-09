"use strict";

const request = require("supertest");
const crypto = require("crypto");
const { createApp } = require("../src/app");
const firebird = require("../src/shared/database/firebird-client");
const { getStore, _resetForTests } = require("../src/shared/idempotency/idempotency-store");

// Mock de segurança HMAC
const API_KEY = "test-key";
const API_SECRET = "test-secret";
process.env.API_KEY = API_KEY;
process.env.API_SECRET = API_SECRET;
process.env.IDEMPOTENCY_STORE = "memory";
process.env.NODE_ENV = "test";

function sign(method, path, body, timestamp, apiKey, secret) {
  const content = body ? JSON.stringify(body) : "";
  const payload = `${method}${path}${content}${timestamp}${apiKey}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

describe("POST /api/v1/orders (Sprint 7)", () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    _resetForTests();
    jest.clearAllMocks();
  });

  // Mock centralizado do firebird.withTransaction
  const mockTransaction = jest.spyOn(firebird, "withTransaction");

  it("deve rejeitar pedido sem Idempotency-Key", async () => {
    const timestamp = Date.now();
    const body = { companyId: 1, clientId: 100, items: [{ productId: 1, quantity: 1 }] };
    const signature = sign("POST", "/api/v1/orders", body, timestamp, API_KEY, API_SECRET);

    const res = await request(app)
      .post("/api/v1/orders")
      .send(body)
      .set("x-api-key", API_KEY)
      .set("x-timestamp", timestamp.toString())
      .set("x-signature", signature);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("deve rejeitar pedido com empresa inválida (não 1 ou 3)", async () => {
    const timestamp = Date.now();
    const body = { 
      companyId: 2, 
      clientId: 100, 
      sellerId: 1, 
      saleTypeId: 1, 
      paymentTermId: 1, 
      paymentMethodId: 1,
      deliver: true,
      deliveryAt: new Date().toISOString(),
      returnEquipment: false,
      items: [{ productId: 1, quantity: 1 }] 
    };
    const signature = sign("POST", "/api/v1/orders", body, timestamp, API_KEY, API_SECRET);

    const res = await request(app)
      .post("/api/v1/orders")
      .send(body)
      .set("x-api-key", API_KEY)
      .set("x-timestamp", timestamp.toString())
      .set("x-signature", signature)
      .set("idempotency-key", "key-1");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("deve rejeitar pedido se algum produto não tiver preço", async () => {
    // Mocking pricing resolution to fail
    const pricingService = require("../src/modules/pricing/pricing.service");
    jest.spyOn(pricingService, "resolvePrice").mockResolvedValue({ priceFound: false });
    
    // Mocking client to exist
    const clientsService = require("../src/modules/clients/clients.service");
    jest.spyOn(clientsService, "getClientById").mockResolvedValue({ 
      id: 100, 
      address: { city: "Joinville", state: "SC" } 
    });

    // Mocking product to exist and be active
    const productsService = require("../src/modules/products/products.service");
    jest.spyOn(productsService, "getProductById").mockResolvedValue({ id: 1, active: true });

    const timestamp = Date.now();
    const body = { 
      companyId: 1, 
      clientId: 100, 
      sellerId: 1, 
      saleTypeId: 1, 
      paymentTermId: 1, 
      paymentMethodId: 1,
      deliver: true,
      deliveryAt: new Date().toISOString(),
      returnEquipment: false,
      items: [{ productId: 1, quantity: 1 }] 
    };
    const signature = sign("POST", "/api/v1/orders", body, timestamp, API_KEY, API_SECRET);

    const res = await request(app)
      .post("/api/v1/orders")
      .send(body)
      .set("x-api-key", API_KEY)
      .set("x-timestamp", timestamp.toString())
      .set("x-signature", signature)
      .set("idempotency-key", "key-2");

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PRICE_NOT_FOUND");
  });

  it("deve lidar com duplicatas de Idempotency-Key com payloads diferentes (409)", async () => {
    const store = getStore();
    await store.init();
    const key = "dup-key";
    await store.put(key, { requestHash: "hash-original", status: 201, body: {} });

    const timestamp = Date.now();
    const body = { 
      companyId: 1, 
      clientId: 100, 
      sellerId: 1, 
      saleTypeId: 1, 
      paymentTermId: 1, 
      paymentMethodId: 1,
      deliver: true,
      deliveryAt: new Date().toISOString(),
      returnEquipment: false,
      items: [{ productId: 1, quantity: 1 }] 
    };
    const signature = sign("POST", "/api/v1/orders", body, timestamp, API_KEY, API_SECRET);

    const res = await request(app)
      .post("/api/v1/orders")
      .send(body)
      .set("x-api-key", API_KEY)
      .set("x-timestamp", timestamp.toString())
      .set("x-signature", signature)
      .set("idempotency-key", key);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ORDER_CONFLICT");
  });

  // Mais testes (Graal, Grott, Rollback, SQL Injection, Re-leitura) seriam mocks 
  // pesados aqui ou exigiriam base Firebird de teste. 
  // No ambiente Lovable, validamos a estrutura e lógica de orquestração.
});
