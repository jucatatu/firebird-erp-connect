"use strict";

const companyRule = require("../../shared/company/company-rule");
const { maskDocument, documentType, maskPhone, onlyDigits } = require("../../shared/utils/mask");
const {
  pick,
  toNullableString,
  toNullableInt,
} = require("../operations/operations.mapper");

/**
 * Estratégia de busca acento-insensível LIMITADA e segura.
 *
 * O Firebird desta instalação usa WIN1252 e a collation padrão do charset
 * NÃO é accent-insensitive (não foi confirmada nenhuma collation _CI_AI).
 * Em vez de carregar a tabela para normalizar em memória (proibido), o
 * termo é convertido em um padrão LIKE onde cada caractere que possui
 * variantes acentuadas vira o coringa de 1 caractere `_`.
 *
 *   "Jose"  → "%J_S_%"  → casa com JOSE e JOSÉ
 *   "João"  → "%J__O%"  → casa com JOAO e JOÃO
 *
 * O padrão é sempre aplicado sobre UPPER(coluna) e continua 100%
 * parametrizado (o padrão é um VALOR, nunca concatenado na SQL).
 */
const ACCENT_CLASSES = "AEIOUCN";

/** Remove acentos do termo digitado antes do folding (NFD + strip). */
function stripAccents(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function foldToLikePattern(term) {
  const upper = stripAccents(term)
    .toUpperCase()
    .replace(/[%_]/g, " ")
    .trim();
  
  if (!upper) return "%%";

  let out = "";
  let wildcardsCount = 0;
  for (const ch of upper) {
    if (ACCENT_CLASSES.includes(ch)) {
      // Sprint 8.5.4: Limita a no máximo 2 coringas por termo para evitar %_M__%
      // que casa com "EDIMAR MIRANDA" para o termo "Romeu".
      if (wildcardsCount < 2) {
        out += "_";
        wildcardsCount++;
      } else {
        out += ch;
      }
    } else {
      out += ch;
    }
  }
  return `%${out}%`;
}

/** Padrão LIKE exato (sem folding) — usado como primeira alternativa. */
function exactLikePattern(term) {
  const upper = String(term).toUpperCase().replace(/[%_]/g, " ").trim();
  return `%${upper}%`;
}

function buildQPatterns(term) {
  const exact = exactLikePattern(term);
  if (term.length < 3) return [exact]; // Termos curtos: apenas exato.

  const folded = foldToLikePattern(term);
  return folded === exact ? [exact] : [exact, folded];
}

/**
 * ATIVO / BLOQUEADO.
 *
 * Regra: NADA é inventado. Se a coluna correspondente não foi confirmada
 * pela introspecção do schema, o campo é `null` — nunca `true`/`false`.
 * `DELETED` é exclusão lógica e é tratado separadamente de bloqueio.
 */
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
    // Sanitização: sem quebras de linha, tamanho limitado.
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

/** Item de listagem — nunca inclui documento integral. */
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

/** Detalhe — superset do item de listagem, ainda com documento mascarado. */
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
      ? toNullableInt(pick(row, "ID_CONDICAO_PAGAMENTO"))
      : null,
  };
}

module.exports = {
  buildQPatterns,
  foldToLikePattern,
  exactLikePattern,
  mapStatusFlags,
  mapDocument,
  resolveCompany,
  mapRegisteredAddress,
  mapLastOrderAddress,
  mapClientListItem,
  mapClientDetail,
};
