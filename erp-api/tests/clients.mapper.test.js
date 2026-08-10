"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");

const mapper = require("../src/modules/clients/clients.mapper");
const { maskDocument, maskPhone, documentType } = require("../src/shared/utils/mask");

const FULL_SCHEMA = {
  client: {
    personId: "ID_PESSOA", companyId: "ID_EMPRESA", groupId: "ID_GRUPO_CLIENTE",
    sellerId: "ID_VENDEDOR", paymentMethodId: "ID_FORMA_PAGAMENTO",
    paymentTermId: "ID_CONDICAO_PAGAMENTO", active: "ATIVO", deleted: "DELETED",
    blocked: "BLOQUEADO", blockedFinancial: "BLOQUEADO_FINANCEIRO",
    blockReason: "MOTIVO_BLOQUEIO", code: "CODIGO", stateId: "ID_ESTADO",
    cityId: "ID_CIDADE", districtId: "ID_BAIRRO", streetId: "ID_RUA",
    addressNumber: "NUMERO", addressComplement: "COMPLEMENTO", zip: "CEP",
  },
  person: { name: "NOME", tradeName: "APELIDO", cpf: "CPF", cnpj: "CNPJ", deleted: "DELETED" },
  group: { description: "DESCRICAO" },
};

const MINIMAL_SCHEMA = {
  client: Object.fromEntries(Object.keys(FULL_SCHEMA.client).map((k) => [k, null])),
  person: { name: null, tradeName: null, cpf: null, cnpj: null, deleted: null },
  group: { description: null },
};
MINIMAL_SCHEMA.client.personId = "ID_PESSOA";

test("mascaramento de CPF nunca expõe o documento completo", () => {
  const masked = maskDocument("12345678901");
  assert.ok(!masked.includes("12345678901"));
  assert.match(masked, /\*/);
  assert.equal(documentType("12345678901"), "cpf");
});

test("mascaramento de CNPJ nunca expõe o documento completo", () => {
  const masked = maskDocument("12345678000199");
  assert.ok(!masked.includes("12345678000199"));
  assert.equal(documentType("12345678000199"), "cnpj");
});

test("telefone é mascarado", () => {
  const masked = maskPhone("47999887766");
  assert.ok(!masked.includes("999887766"));
  assert.match(masked, /\*/);
});

test("listItem e detail nunca contêm documento em claro", () => {
  const row = {
    ID_CLIENTE: 10, CLIENTE_NOME: "JOSE DA SILVA", CPF: "12345678901",
    CNPJ: null, CLIENTE_ID_EMPRESA: 3, CIDADE: "JOINVILLE",
  };
  const item = mapper.mapClientListItem(row, FULL_SCHEMA, { phone: "47999887766" });
  const detail = mapper.mapClientDetail(row, FULL_SCHEMA, { phone: "47999887766" });
  for (const obj of [item, detail]) {
    const json = JSON.stringify(obj);
    assert.ok(!json.includes("12345678901"), json);
    assert.ok(!json.includes("47999887766"), json);
  }
  assert.equal(item.companyId, 3);
  assert.equal(item.companyName, "Grott");
});

test("schema mínimo: campos ausentes viram null, sem inventar valores", () => {
  const item = mapper.mapClientListItem({ ID_CLIENTE: 5 }, MINIMAL_SCHEMA, {});
  assert.equal(item.active, null);
  assert.equal(item.blocked, null);
  assert.equal(item.blockType, null);
  assert.equal(item.documentMasked, null);
  assert.equal(item.groupId, null);
  assert.equal(item.city, null);
  // Empresa sempre resolve pela regra oficial (fallback 1).
  assert.equal(item.companyId, 1);
});

test("bloqueio financeiro tem precedência na tipificação", () => {
  const flags = mapper.mapStatusFlags(
    { CLIENTE_BLOQUEADO: 0, CLIENTE_BLOQUEADO_FIN: 1, CLIENTE_MOTIVO_BLOQUEIO: "inadimplente\n\nteste" },
    FULL_SCHEMA,
  );
  assert.equal(flags.blocked, true);
  assert.equal(flags.blockType, "financial");
  assert.equal(flags.blockReason, "inadimplente teste");
});

test("coluna INATIVO é interpretada de forma invertida", () => {
  const schema = { ...FULL_SCHEMA, client: { ...FULL_SCHEMA.client, active: "INATIVO" } };
  assert.equal(mapper.mapStatusFlags({ CLIENTE_ATIVO: 1 }, schema).active, false);
  assert.equal(mapper.mapStatusFlags({ CLIENTE_ATIVO: 0 }, schema).active, true);
});

test("folding de acentos gera padrão que casa com e sem acento", () => {
  assert.equal(mapper.buildQPatterns("Jose")[0], "%JOSE%");
  assert.equal(mapper.buildQPatterns("João")[0], "%JOAO%");
  assert.deepEqual(mapper.buildQPatterns("Jose"), ["%JOSE%"]);
});

test("coringas do usuário são neutralizados (sem LIKE injection)", () => {
  assert.ok(!mapper.exactLikePattern("a%b_c").slice(1, -1).includes("%"));
  assert.ok(!mapper.exactLikePattern("a%b_c").slice(1, -1).includes("_"));
});

test("endereço do último pedido é sinalizado como fallback", () => {
  const addr = mapper.mapLastOrderAddress({ RUA: "RUA X", CIDADE: "JOINVILLE" });
  assert.equal(addr.origin, "last_order");
  const reg = mapper.mapRegisteredAddress({ RUA: "RUA Y", CIDADE: "BLUMENAU" }, FULL_SCHEMA);
  assert.equal(reg.origin, "registered");
});
