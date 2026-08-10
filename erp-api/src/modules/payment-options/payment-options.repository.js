"use strict";

const firebird = require("../../shared/database/firebird-client");

async function listPaymentTerms() {
  const sql = \`
    SELECT 
      ID_FPGTO AS id, 
      CODIGO AS code, 
      DESCRICAO AS description
    FROM FPGTO
    WHERE (DELETED IS NULL OR DELETED = 0)
      AND (INATIVO IS NULL OR INATIVO = 0)
    ORDER BY DESCRICAO
  \`;
  return firebird.executeQuery(sql);
}

async function listPaymentMethods() {
  const sql = \`
    SELECT 
      ID_FORMA_PAGAMENTO AS id, 
      DESCRICAO AS description,
      TIPO AS type
    FROM FORMA_PAGAMENTO
    WHERE (DELETED IS NULL OR DELETED = 0)
      AND (INATIVO IS NULL OR INATIVO = 0)
    ORDER BY DESCRICAO
  \`;
  return firebird.executeQuery(sql);
}

async function listSaleTypes() {
  const sql = \`
    SELECT 
      ID_TIPO_VENDA AS id, 
      DESCRICAO AS description
    FROM TIPO_VENDA
    WHERE (DELETED IS NULL OR DELETED = 0)
    ORDER BY DESCRICAO
  \`;
  return firebird.executeQuery(sql);
}

module.exports = {
  listPaymentTerms,
  listPaymentMethods,
  listSaleTypes
};
