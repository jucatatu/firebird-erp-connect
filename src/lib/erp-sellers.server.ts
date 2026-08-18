import type { ErpResponse, ErpSeller } from "./erp-sellers.functions";
import { callErp } from "./erp.server";

/**
 * Recupera os detalhes de um vendedor diretamente do ERP (Server-only).
 */
export async function getErpSellerDetailServer(sellerId: number): Promise<ErpResponse<{ seller: ErpSeller }>> {
  return callErp({
    method: "GET",
    path: `/api/v1/sellers/${sellerId}`
  }) as Promise<ErpResponse<{ seller: ErpSeller }>>;
}

/**
 * Helper server-side para validar um vendedor ERP e sua compatibilidade com empresas.
 * Versão server-only para evitar encadeamento de Server Functions.
 */
export async function validateErpSellerForCompaniesServer(
  erpSellerId: number | null,
  companies: number[]
) {
  if (erpSellerId === null) return { ok: true };

  // Validação básica do ID
  if (erpSellerId <= 0 || !Number.isInteger(erpSellerId)) {
    return { 
      ok: false, 
      error: { code: "INVALID_SELLER_ID", message: "ID de vendedor inválido." } 
    };
  }

  const result = await getErpSellerDetailServer(erpSellerId);

  if (!result.ok) {
    // Preservar códigos de erro específicos do ERP
    const code = result.error?.code || "ERP_UNAVAILABLE";
    const message = (code === "SELLER_NOT_FOUND" || result.status === 404)
      ? "O vendedor selecionado não existe mais no ERP."
      : "Não foi possível consultar os vendedores no ERP neste momento. Tente novamente.";
    
    return { ok: false, error: { code, message } };
  }

  const seller = result.data?.seller;
  if (!seller) {
    return { 
      ok: false, 
      error: { code: "SELLER_NOT_FOUND", message: "O vendedor selecionado não existe mais no ERP." } 
    };
  }

  if (!companies.includes(seller.companyId)) {
    return { 
      ok: false, 
      error: { 
        code: "SELLER_COMPANY_MISMATCH", 
        message: "O vendedor ERP selecionado pertence a uma empresa que não está habilitada para este usuário." 
      } 
    };
  }

  return { ok: true, seller };
}
