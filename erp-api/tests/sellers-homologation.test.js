"use strict";

const test = require("node:test");
const expect = require("node:assert");
const request = require("supertest");
const crypto = require("crypto");

// Forçamos bypass de auth para testes se não tivermos as chaves reais
process.env.SKIP_AUTH_FOR_TEST = "true";
const app = require("../src/app").createApp();

test("Sellers Module (Homologated)", async (t) => {
  await t.test("GET /api/v1/sellers", async (t) => {
    await t.test("should list sellers with default limit", async () => {
      const path = "/api/v1/sellers";
      const res = await request(app).get(path);

      if (res.status === 503) {
        expect.strictEqual(res.body.error.code, "ERP_UNAVAILABLE");
        return;
      }

      expect.strictEqual(res.status, 200);
      expect.strictEqual(res.body.success, true);
      expect.strictEqual(Array.isArray(res.body.sellers), true);
    });

    await t.test("should return 400 for invalid companyId", async () => {
      const path = "/api/v1/sellers?companyId=99";
      const res = await request(app).get(path);

      expect.strictEqual(res.status, 400);
    });
  });

  await t.test("GET /api/v1/sellers/:id", async (t) => {
    await t.test("should return 404 for non-existent seller", async () => {
      const path = "/api/v1/sellers/999999";
      const res = await request(app).get(path);

      if (res.status === 503) return; 

      expect.strictEqual(res.status, 404);
      expect.strictEqual(res.body.error.code, "SELLER_NOT_FOUND");
    });
  });
});
