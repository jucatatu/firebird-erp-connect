import { describe, it, expect, vi, beforeEach } from "vitest";
import { getErpSellerDetailServer, validateErpSellerForCompaniesServer } from "../erp-sellers.server";
import * as erpServer from "../erp.server";

vi.mock("../erp.server", () => ({
  callErp: vi.fn(),
}));

describe("erp-sellers.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getErpSellerDetailServer", () => {
    it("should return seller data on success", async () => {
      const mockSeller = { id: 123, name: "Test Seller", companyId: 1 };
      vi.mocked(erpServer.callErp).mockResolvedValue({
        ok: true,
        status: 200,
        data: { seller: mockSeller },
        error: null,
      } as any);

      const result = await getErpSellerDetailServer(123);
      expect(result.ok).toBe(true);
      expect(result.data?.seller).toEqual(mockSeller);
    });
  });

  describe("validateErpSellerForCompaniesServer", () => {
    it("should return ok for null sellerId", async () => {
      const result = await validateErpSellerForCompaniesServer(null, [1]);
      expect(result.ok).toBe(true);
    });

    it("should fail for invalid ID", async () => {
      const result = await validateErpSellerForCompaniesServer(-1, [1]);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("INVALID_SELLER_ID");
    });

    it("should fail for seller not found (404)", async () => {
      vi.mocked(erpServer.callErp).mockResolvedValue({
        ok: false,
        status: 404,
        data: null,
        error: { code: "SELLER_NOT_FOUND", message: "Not found", retryable: false },
      } as any);

      const result = await validateErpSellerForCompaniesServer(123, [1]);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("SELLER_NOT_FOUND");
    });

    it("should fail for company mismatch", async () => {
      const mockSeller = { id: 123, name: "Test Seller", companyId: 3 };
      vi.mocked(erpServer.callErp).mockResolvedValue({
        ok: true,
        status: 200,
        data: { seller: mockSeller },
        error: null,
      } as any);

      const result = await validateErpSellerForCompaniesServer(123, [1]);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("SELLER_COMPANY_MISMATCH");
    });

    it("should handle ERP network error", async () => {
      vi.mocked(erpServer.callErp).mockResolvedValue({
        ok: false,
        status: 500,
        data: null,
        error: { code: "ERP_NETWORK_ERROR", message: "Network error", retryable: true },
      } as any);

      const result = await validateErpSellerForCompaniesServer(123, [1]);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("ERP_NETWORK_ERROR");
    });

    it("should handle ERP timeout", async () => {
      vi.mocked(erpServer.callErp).mockResolvedValue({
        ok: false,
        status: 504,
        data: null,
        error: { code: "ERP_TIMEOUT", message: "Timeout", retryable: true },
      } as any);

      const result = await validateErpSellerForCompaniesServer(123, [1]);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("ERP_TIMEOUT");
    });
  });
});
