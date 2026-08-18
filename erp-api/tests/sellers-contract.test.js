"use strict";

const test = require("node:test");
const expect = require("node:assert");
const request = require("supertest");
const { mock } = require("node:test");

// Forçar variáveis de ambiente mínimas para o Zod não travar o boot do app nos testes
process.env.FIREBIRD_HOST = "localhost";
process.env.FIREBIRD_DATABASE = "test.fdb";
process.env.FIREBIRD_USER = "SYSDBA";
process.env.FIREBIRD_PASSWORD = "masterkey";
process.env.SKIP_AUTH_FOR_TEST = "true";
process.env.NODE_ENV = "test";

// Mocking the repository to test the contract deterministically
const sellersRepository = require("../src/modules/sellers/sellers.repository");

const app = require("../src/app").createApp();

test("Sellers Module Contract (Isolated)", async (t) => {
  // Mock searchSellers
  mock.method(sellersRepository, "searchSellers", async ({ query, limit, companyId }) => {
    if (companyId === 99) return [];
    return [
      { id: 1, name: "VENDEDOR TESTE", nickname: "TESTE", companyId: 1 }
    ];
  });

  // Mock getSellerById
  mock.method(sellersRepository, "getSellerById", async (id) => {
    if (id === 1) {
      return { id: 1, name: "VENDEDOR TESTE", nickname: "TESTE", companyId: 1 };
    }
    return null;
  });

  await t.test("GET /api/v1/sellers", async (t) => {
    await t.test("should return success.data.sellers format", async () => {
      const res = await request(app).get("/api/v1/sellers");
      
      expect.strictEqual(res.status, 200);
      expect.strictEqual(res.body.success, true);
      expect.ok(res.body.data, "Response should have a data property");
      expect.ok(Array.isArray(res.body.data.sellers), "data.sellers should be an array");
      expect.strictEqual(res.body.data.sellers[0].id, 1);
      expect.strictEqual(res.body.data.sellers[0].name, "VENDEDOR TESTE");
    });

    await t.test("should return 400 for invalid companyId", async () => {
      const res = await request(app).get("/api/v1/sellers?companyId=99");
      expect.strictEqual(res.status, 400);
    });

    await t.test("should return 400 for invalid limit (above max)", async () => {
      const res = await request(app).get("/api/v1/sellers?limit=101");
      expect.strictEqual(res.status, 400);
    });
  });

  await t.test("GET /api/v1/sellers/:id", async (t) => {
    await t.test("should return success.data.seller format", async () => {
      const res = await request(app).get("/api/v1/sellers/1");
      
      expect.strictEqual(res.status, 200);
      expect.strictEqual(res.body.success, true);
      expect.ok(res.body.data, "Response should have a data property");
      expect.ok(res.body.data.seller, "data.seller should exist");
      expect.strictEqual(res.body.data.seller.id, 1);
    });

    await t.test("should return 404 with SELLER_NOT_FOUND code for missing seller", async () => {
      const res = await request(app).get("/api/v1/sellers/999");
      
      expect.strictEqual(res.status, 404);
      expect.strictEqual(res.body.success, false);
      expect.strictEqual(res.body.error.code, "SELLER_NOT_FOUND");
    });

    await t.test("should return 400 for invalid ID (non-numeric)", async () => {
      const res = await request(app).get("/api/v1/sellers/abc");
      expect.strictEqual(res.status, 400);
    });
  });
});
