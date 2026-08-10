"use strict";

const repository = require("./payment-options.repository");
const { AppError } = require("../../shared/errors/app-error");

async function getPaymentOptions() {
  try {
    const [terms, methods, saleTypes] = await Promise.all([
      repository.listPaymentTerms(),
      repository.listPaymentMethods(),
      repository.listSaleTypes()
    ]);

    return {
      paymentTerms: terms.map(t => ({ 
        id: Number(t.ID || t.id), 
        code: String(t.CODE || t.code || "").trim(),
        description: String(t.DESCRIPTION || t.description || "").trim() 
      })),
      paymentMethods: methods.map(m => ({ 
        id: Number(m.ID || m.id), 
        description: String(m.DESCRIPTION || m.description || "").trim(),
        type: String(m.TYPE || m.type || "").trim()
      })),
      saleTypes: saleTypes.map(s => ({ 
        id: Number(s.ID || s.id), 
        description: String(s.DESCRIPTION || s.description || "").trim() 
      }))
    };
  } catch (err) {
    throw new AppError({
      message: "Não foi possível carregar as opções de pagamento do ERP.",
      statusCode: 500,
      code: "PAYMENT_OPTIONS_FAILED",
      retryable: true
    });
  }
}

module.exports = {
  getPaymentOptions
};
