"use strict";

const { pick, toNullableString, toNullableInt } = require("../operations/operations.mapper");
const { accentInsensitiveSqlExpression, exactLikePattern } = require("../../shared/search/like-pattern");
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

function mapStatusFlags(row, schema) {
  const c = schema.client;
  const activeVal = row.CLIENTE_ATIVO;
  const blockedVal = row.CLIENTE_BLOQUEADO;
  const blockedFinVal = row.CLIENTE_BLOQUEADO_FIN;

  let active = activeVal === null || activeVal === undefined ? null : !!activeVal;
  if (c.active === "INATIVO" && active !== null) {
    active = !active;
  }

  const blocked = !!blockedVal || !!blockedFinVal;
  const blockType = blockedFinVal ? "financial" : (blockedVal ? "commercial" : null);
  const blockReason = toNullableString(row.CLIENTE_MOTIVO_BLOQUEIO)?.replace(/\n/g, " ") || null;

  return { active, blocked, blockType, blockReason };
}

function mapClientListItem(row, schema, contact = {}) {
  const flags = mapStatusFlags(row, schema);
  const doc = row.CPF_CNPJ || row.CPF || row.CNPJ;
  
  return {
    id: row.ID_CLIENTE,
    name: row.CLIENTE_NOME,
    tradeName: row.CLIENTE_APELIDO,
    documentMasked: doc ? maskDocument(doc) : null,
    phoneMasked: contact.phone ? maskPhone(contact.phone) : null,
    companyId: row.CLIENTE_ID_EMPRESA || 1,
    companyName: row.CLIENTE_ID_EMPRESA === 3 ? "Grott" : "Graal",
    groupId: row.ID_GRUPO_CLIENTE,
    groupDescription: row.GRUPO_CLIENTE_DESCRICAO,
    city: row.CIDADE,
    ...flags,
  };
}

function mapClientDetail(row, schema, contact = {}) {
  const base = mapClientListItem(row, schema, contact);
  return {
    ...base,
    address: {
      street: row.RUA,
      number: row.NUMERO,
      complement: row.COMPLEMENTO,
      district: row.BAIRRO,
      city: row.CIDADE,
      state: row.UF,
      zip: row.CEP,
    }
  };
}

function mapLastOrderAddress(row) {
  if (!row) return null;
  return {
    origin: "last_order",
    street: row.RUA,
    number: row.NUMERO,
    complement: row.COMPLEMENTO,
    district: row.BAIRRO,
    city: row.CIDADE,
    state: row.UF,
    orderId: row.ID_ORDENS_VENDA,
    orderNumber: row.N_PEDIDO,
  };
}

function mapRegisteredAddress(row, schema) {
  if (!row) return null;
  return {
    origin: "registered",
    street: row.RUA,
    number: row.NUMERO,
    complement: row.COMPLEMENTO,
    district: row.BAIRRO,
    city: row.CIDADE,
    state: row.UF,
    zip: row.CEP,
  };
}

function buildQPatterns(q) {
  if (!q) return [];
  // Remove acentos e converte para uppercase para busca case-insensitive no Firebird
  const normalized = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return [normalized.includes("%") || normalized.includes("_") ? normalized : exactLikePattern(normalized)];
}

function sharedBuildQPatterns(q) {
  return buildQPatterns(q);
}

function mapName(row) {
  const nome = toNullableString(pick(row, "CLIENTE_NOME"));
  const apelido = toNullableString(pick(row, "CLIENTE_APELIDO"));
  return nome || apelido || "";
}

function resolveCompany(row, schema) {
  const explicit = toNullableInt(pick(row, "CLIENTE_ID_EMPRESA"));
  if (explicit === 1 || explicit === 3) return explicit;
  
  const groupDesc = toNullableString(row.GRUPO_CLIENTE_DESCRICAO);
  if (groupDesc && /GROTT/i.test(groupDesc)) return 3;
  
  return 1;
}

module.exports = {
  buildCreateClientProcedureParams,
  buildCreateContactParams,
  mapClientListItem,
  mapClientDetail,
  mapStatusFlags,
  mapLastOrderAddress,
  mapRegisteredAddress,
  buildQPatterns,
  exactLikePattern,
  mapName,
  resolveCompany,
  sharedBuildQPatterns
};
