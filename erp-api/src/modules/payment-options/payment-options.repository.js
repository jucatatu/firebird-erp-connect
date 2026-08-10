"use strict";

const firebird = require("../../shared/database/firebird-client");

async function listPaymentTerms() {
  const sql = `
    SELECT ID_CONDICAO_PAGAMENTO as id, DESCRICAO as description
    FROM CONDICAO_PAGAMENTO
    WHERE (DELETED IS NULL OR DELETED = 0)
    ORDER BY DESCRICAO
  `;
  return firebird.executeQuery(sql);
}

async function listPaymentMethods() {
  const sql = `
    SELECT ID_FORMA_PAGAMENTO as id, DESCRICAO as description
    FROM FORMA_PAGAMENTO
    WHERE (DELETED IS NULL OR DELETED = 0)
    ORDER BY DESCRICAO
  `;
  return firebird.executeQuery(sql);
}

async function listSaleTypes() {
  const sql = `
    SELECT ID_TIPO_VENDA as id, DESCRICAO as description
    FROM TIPO_VENDA
    WHERE (DELETED IS NULL OR DELETED = 0)
    ORDER BY DESCRICAO
  `;
  return firebird.executeQuery(sql);
}

module.exports = {
  listPaymentTerms,
  listPaymentMethods,
  listSaleTypes
};
