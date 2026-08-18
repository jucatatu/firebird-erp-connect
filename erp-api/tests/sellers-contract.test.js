"use strict";

require("./helpers/env");
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const path = require("path");

// Mock repository
const sellersRepository = require("../src/modules/sellers/sellers.repository");
const originalSearchSellers = sellersRepository.searchSellers;
const originalGetSellerById = sellersRepository.getSellerById;

const { createApp } = require("../src/app");

test("Sellers Contract", async (t) => {
  const app = createApp();
  const API_KEY = process.env.API_KEY || "test-api-key";
  const HMAC_SECRET = process.env.HMAC_SECRET || "test-hmac-secret";

  const { sign } = require("./helpers/sign");
  function signedGet(urlPath, headers = {}) {
    const { headers: sig } = sign({
      method: "GET",
      path: urlPath,
      apiKey: API_KEY,
      secret: HMAC_SECRET,
    });
    return request(app).get(urlPath).set({ ...sig, ...headers });
  }

  await t.test("GET /api/v1/sellers - Sucesso", async () => {
    sellersRepository.searchSellers = async () => [{ id: 1, name: "Seller 1", companyId: 1 }];
    const res = await signedGet("/api/v1/sellers");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.sellers));
    assert.equal(res.body.data.sellers[0].id, 1);
  });

  await t.test("GET /api/v1/sellers/:id - Sucesso", async () => {
    sellersRepository.getSellerById = async (id) => ({ id, name: "Seller 1", companyId: 1 });
    const res = await signedGet("/api/v1/sellers/1");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.seller.id, 1);
  });

  await t.test("Filtro companyId válido", async () => {
    const res1 = await signedGet("/api/v1/sellers?companyId=1");
    assert.equal(res1.status, 200);
    const res3 = await signedGet("/api/v1/sellers?companyId=3");
    assert.equal(res3.status, 200);
  });

  await t.test("Filtro companyId inválido -> 400", async () => {
    const res = await signedGet("/api/v1/sellers?companyId=99");
    assert.equal(res.status, 400);
  });

  await t.test("Limit malformado -> 400", async () => {
    const res = await signedGet("/api/v1/sellers?limit=1.5");
    assert.equal(res.status, 400);
    const res2 = await signedGet("/api/v1/sellers?limit=10abc");
    assert.equal(res2.status, 400);
  });

  await t.test("ID malformado -> 400", async () => {
    const res = await signedGet("/api/v1/sellers/1abc");
    assert.equal(res.status, 400);
    const res2 = await signedGet("/api/v1/sellers/0");
    assert.equal(res2.status, 400);
    const res3 = await signedGet("/api/v1/sellers/-1");
    assert.equal(res3.status, 400);
  });

  await t.test("Seller inexistente -> 404", async () => {
    sellersRepository.getSellerById = async () => null;
    const res = await signedGet("/api/v1/sellers/999");
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "SELLER_NOT_FOUND");
  });

  // Restore repository
  sellersRepository.searchSellers = originalSearchSellers;
  sellersRepository.getSellerById = originalGetSellerById;
});
