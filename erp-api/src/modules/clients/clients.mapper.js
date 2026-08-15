"use strict";

const { pick, toNullableString } = require("../operations/operations.mapper");
const { maskDocument, documentType, maskPhone } = require("../../shared/utils/mask");

/**
 * Constrói o array posicional de 34 parâmetros para a SP_CAD_CLIENTE_COMPLETO.
 * Fonte: Sprint 8.9.42, seção 14.
 */
function buildCreateClientProcedureParams(data) {
  const p = new Array(34).fill(null);
  
  p[0]  = data.companyId;
  p[1]  = data.groupId;
  p[2]  = null; // ID_TABELA_PRECO
  p[3]  = data.sellerId;
  p[4]  = data.paymentTermId;
  p[5]  = data.paymentMethodId;
  p[6]  = null; // ID_TRANSPORTADOR
  p[7]  = data.name.toUpperCase().substring(0, 100);
  p[8]  = data.tradeName ? data.tradeName.toUpperCase().substring(0, 100) : null;
  p[9]  = data.personType === "PJ" ? 1 : null; // JURIDICA
  p[10] = data.document; // CNPJ
  p[11] = null; // RG
  p[12] = null; // IE
  p[13] = null; // DATA_NASC
  p[14] = data.address.state.toUpperCase();
  p[15] = data.address.city.toUpperCase();
  p[16] = data.address.district.toUpperCase();
  p[17] = data.address.street.toUpperCase();
  p[18] = data.address.number;
  p[19] = data.address.zip || null;
  p[20] = data.address.complement || null;
  p[21] = null; // LATLONG
  p[22] = null; // DIA_ATENDIMENTO
  p[23] = null; // PERIODICIDADE
  p[24] = null; // CODIGO_INTEGRACAO
  p[25] = null; // LIMITE_CREDITO
  p[26] = null; // INATIVO
  p[27] = null; // EXTRA
  p[28] = null; // ID_USER
  p[29] = null; // CHAVE
  p[30] = null; // PERCENT_DESC_COMERCIAL
  p[31] = null; // REGIAO
  p[32] = null; // ID_OPERACAO
  p[33] = null; // EMAIL_NA_NFE

  return p;
}

/**
 * Constrói o array posicional de 5 parâmetros para a SP_CAD_CONTATOS.
 * 0: ID_PESSOA, 1: FONE, 2: CELULAR, 3: EMAIL, 4: OUTRO
 */
function buildCreateContactParams(personId, data) {
  return [
    personId,
    data.phone || null,
    data.mobile,
    data.email || null,
    null // OUTRO
  ];
}

module.exports = {
  buildCreateClientProcedureParams,
  buildCreateContactParams
};
