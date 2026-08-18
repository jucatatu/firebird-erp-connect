"use strict";

const request = require("supertest");
const app = require("../src/app");
const firebird = require("../src/shared/database/firebird-client");

describe("Sellers Module (Homologated)", () => {
  const apiKey = process.env.API_KEY || "test-api-key";
  const apiSecret = process.env.API_SECRET || "test-api-secret";

  function getAuthHeaders(method, path, body = null) {
    const timestamp = Math.floor(Date.now() / 1000);
    const crypto = require("crypto");
    const bodyStr = body ? JSON.stringify(body) : "";
    const signature = crypto
      .createHmac("sha256", apiSecret)
      .update(`${timestamp}${method}${path}${bodyStr}`)
      .digest("hex");

    return {
      "x-api-key": apiKey,
      "x-timestamp": timestamp,
      "x-signature": signature
    };
  }

  describe("GET /api/v1/sellers", () => {
    it("should list sellers with default limit", async () => {
      const path = "/api/v1/sellers";
      const res = await request(app)
        .get(path)
        .set(getAuthHeaders("GET", path));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.sellers)).toBe(true);
      
      if (res.body.sellers.length > 0) {
        const seller = res.body.sellers[0];
        expect(seller).toHaveProperty("id");
        expect(seller).toHaveProperty("name");
        expect(seller).toHaveProperty("companyId");
        expect([1, 3]).toContain(seller.companyId);
      }
    });

    it("should filter by companyId=1", async () => {
      const path = "/api/v1/sellers?companyId=1";
      const res = await request(app)
        .get(path)
        .set(getAuthHeaders("GET", path));

      expect(res.status).toBe(200);
      res.body.sellers.forEach(s => {
        expect(s.companyId).toBe(1);
      });
    });

    it("should return 400 for invalid companyId", async () => {
      const path = "/api/v1/sellers?companyId=99";
      const res = await request(app)
        .get(path)
        .set(getAuthHeaders("GET", path));

      expect(res.status).toBe(400);
    });

    it("should search by name (q)", async () => {
      // Primeiro pegamos um nome real se existir
      const listRes = await request(app)
        .get("/api/v1/sellers?limit=1")
        .set(getAuthHeaders("GET", "/api/v1/sellers?limit=1"));
      
      if (listRes.body.sellers.length > 0) {
        const realName = listRes.body.sellers[0].name;
        const searchPath = `/api/v1/sellers?q=${encodeURIComponent(realName)}`;
        const res = await request(app)
          .get(searchPath)
          .set(getAuthHeaders("GET", searchPath));

        expect(res.status).toBe(200);
        expect(res.body.sellers.length).toBeGreaterThan(0);
        expect(res.body.sellers[0].name).toBe(realName);
      }
    });
  });

  describe("GET /api/v1/sellers/:id", () => {
    it("should return seller by ID", async () => {
      const listRes = await request(app)
        .get("/api/v1/sellers?limit=1")
        .set(getAuthHeaders("GET", "/api/v1/sellers?limit=1"));
      
      if (listRes.body.sellers.length > 0) {
        const realId = listRes.body.sellers[0].id;
        const path = `/api/v1/sellers/${realId}`;
        const res = await request(app)
          .get(path)
          .set(getAuthHeaders("GET", path));

        expect(res.status).toBe(200);
        expect(res.body.seller.id).toBe(realId);
      }
    });

    it("should return 404 for non-existent seller", async () => {
      const path = "/api/v1/sellers/999999";
      const res = await request(app)
        .get(path)
        .set(getAuthHeaders("GET", path));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("SELLER_NOT_FOUND");
    });
  });
});
