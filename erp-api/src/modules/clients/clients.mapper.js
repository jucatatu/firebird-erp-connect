"use strict";

const companyRule = require("../../shared/company/company-rule");
const { maskDocument, documentType, maskPhone, onlyDigits } = require("../../shared/utils/mask");
const { buildQPatterns: sharedBuildQPatterns } = require("../../shared/search/like-pattern");
const {
  pick,
  toNullableString,
  toNullableInt,
} = require("../operations/operations.mapper");

/**
 * Reutiliza o helper compartilhado para manter a consistência entre módulos.
 */
function buildQPatterns(term) {
  return sharedBuildQPatterns(term);
}

function mapStatusFlags(row, schema) {
  const c = schema.client;
  let active = null;
  if (c.active) {
    const raw = pick(row, "CLIENTE_ATIVO");
    const n = toNullableInt(raw);
    const s = toNullableString(raw);
    if (c.active === "INATIVO") {
      active = n === null && s === null ? null : !(n === 1 || (s && /^(S|SIM|T|TRUE)$/i.test(s)));
    } else if (n !== null) {
      active = n === 1;
    } else if (s !== null) {
      active = /^(S|SIM|A|ATIVO|T|TRUE|1)$/i.test(s);
    }
  }
  let blocked = null;
  let blockType = null;
  const commercialRaw = c.blocked ? pick(row, "CLIENTE_BLOQUEADO") : undefined;
  const financialRaw = c.blockedFinancial ? pick(row, "CLIENTE_BLOQUEADO_FIN") : undefined;
  const isTruthyFlag = (v) => {
    const n = toNullableInt(v);
    if (n !== null) return n === 1;
    const s = toNullableString(v);
    if (s !== null) return /^(S|SIM|T|TRUE|1)$/i.test(s);
    return null;
  };
  const commercial = c.blocked ? isTruthyFlag(commercialRaw) : null;
  const financial = c.blockedFinancial ? isTruthyFlag(financialRaw) : null;
  if (commercial !== null || financial !== null) {
    blocked = Boolean(commercial) || Boolean(financial);
    if (blocked) blockType = financial ? "financial" : "commercial";
  }
  let blockReason = null;
  if (c.blockReason && blocked) {
    const reason = toNullableString(pick(row, "CLIENTE_MOTIVO_BLOQUEIO"));
    blockReason = reason ? reason.replace(/\s+/g, " ").slice(0, 200) : null;
  }
  return { active, blocked, blockType, blockReason };
}

function mapDocument(row, schema) {
  const p = schema.person;
  const cnpj = p.cnpj ? onlyDigits(pick(row, "CNPJ")) : "";
  const cpf = p.cpf ? onlyDigits(pick(row, "CPF")) : "";
  const raw = cnpj || cpf || "";
  if (!raw) return { documentMasked: null, documentType: null };
  return { documentMasked: maskDocument(raw), documentType: documentType(raw) };
}

function resolveCompany(row, schema, explicitCompanyId) {
  return companyRule.resolveCompanyId({
    explicitCompanyId,
    clientCompanyId: schema.client.companyId ? pick(row, "CLIENTE_ID_EMPRESA") : null,
    groupDescription: schema.group.description
      ? toNullableString(pick(row, "GRUPO_CLIENTE_DESCRICAO"))
      : null,
  });
}

function mapRegisteredAddress(row, schema) {
  const c = schema.client;
  const hasAny = c.cityId || c.districtId || c.streetId || c.stateId || c.zip;
  if (!hasAny) return null;
  const street = toNullableString(pick(row, "RUA"));
  const city = toNullableString(pick(row, "CIDADE"));
  const district = toNullableString(pick(row, "BAIRRO"));
  const state = toNullableString(pick(row, "UF"));
  const zip = c.zip ? toNullableString(pick(row, "CEP")) : null;
  if (!street && !city && !district && !state && !zip) return null;
  return {
    origin: "registered",
    street,
    number: c.addressNumber ? toNullableString(pick(row, "NUMERO")) : null,
    complement: c.addressComplement ? toNullableString(pick(row, "COMPLEMENTO")) : null,
    district,
    city,
    state,
    zip,
  };
}

function mapLastOrderAddress(orderRow) {
  if (!orderRow) return null;
  return {
    origin: "last_order",
    street: toNullableString(pick(orderRow, "RUA")),
    number: toNullableString(pick(orderRow, "NUMERO")),
    complement: toNullableString(pick(orderRow, "COMPLEMENTO")),
    district: toNullableString(pick(orderRow, "BAIRRO")),
    city: toNullableString(pick(orderRow, "CIDADE")),
    state: toNullableString(pick(orderRow, "UF")),
    zip: null,
  };
}

function mapName(row) {
  return toNullableString(pick(row, "CLIENTE_NOME")) || null;
}

function mapClientListItem(row, schema, ctx = {}) {
  const id = toNullableInt(pick(row, "ID_CLIENTE"));
  const doc = mapDocument(row, schema);
  const flags = mapStatusFlags(row, schema);
  const companyId = resolveCompany(row, schema, null);
  const address = ctx.address || mapRegisteredAddress(row, schema) || null;
  return {
    id,
    code: schema.client.code
      ? toNullableString(pick(row, "CLIENTE_CODIGO")) || (id === null ? null : String(id))
      : id === null
        ? null
        : String(id),
    name: mapName(row),
    tradeName: schema.person.tradeName ? toNullableString(pick(row, "CLIENTE_APELIDO")) : null,
    documentMasked: doc.documentMasked,
    documentType: doc.documentType,
    phoneMasked: ctx.phone ? maskPhone(ctx.phone) : null,
    city: address ? address.city : null,
    district: address ? address.district : null,
    addressOrigin: address ? address.origin : null,
    companyId,
    companyName: companyRule.companyName(companyId),
    groupId: schema.client.groupId ? toNullableInt(pick(row, "ID_GRUPO_CLIENTE")) : null,
    groupDescription: schema.group.description
      ? toNullableString(pick(row, "GRUPO_CLIENTE_DESCRICAO"))
      : null,
    active: flags.active,
    blocked: flags.blocked,
    blockType: flags.blockType,
  };
}

function mapClientDetail(row, schema, ctx = {}) {
  const base = mapClientListItem(row, schema, ctx);
  const flags = mapStatusFlags(row, schema);
  const address = ctx.address || mapRegisteredAddress(row, schema) || null;
  return {
    ...base,
    address,
    blockReason: flags.blockReason,
    sellerId: schema.client.sellerId ? toNullableInt(pick(row, "ID_VENDEDOR")) : null,
    defaultPaymentMethodId: schema.client.paymentMethodId
      ? toNullableInt(pick(row, "ID_FORMA_PAGAMENTO"))
      : null,
    defaultPaymentTermId: schema.client.paymentTermId
      ? toNullableInt(pick(row, "ID_FPGTO"))
      : null,
    defaultSaleTypeId: schema.client.saleTypeId
      ? toNullableInt(pick(row, "ID_OPERACAO"))
      : null,
  };
}

module.exports = {
  buildQPatterns,
  mapStatusFlags,
  mapDocument,
  resolveCompany,
  mapRegisteredAddress,
  mapLastOrderAddress,
  mapClientListItem,
  mapClientDetail,
};
