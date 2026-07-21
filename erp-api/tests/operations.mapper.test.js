"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");

const mapper = require("../src/modules/operations/operations.mapper");

test("toNullableString remove espaços finais de CHAR", () => {
  assert.equal(mapper.toNullableString("Rua Exemplo   "), "Rua Exemplo");
  assert.equal(mapper.toNullableString("   "), null);
  assert.equal(mapper.toNullableString(""), null);
  assert.equal(mapper.toNullableString(null), null);
  assert.equal(mapper.toNullableString(undefined), null);
});

test("toNullableNumber converte números corretamente", () => {
  assert.equal(mapper.toNullableNumber("2"), 2);
  assert.equal(mapper.toNullableNumber(2.5), 2.5);
  assert.equal(mapper.toNullableNumber(""), null);
  assert.equal(mapper.toNullableNumber(null), null);
});

test("toDateOnly retorna YYYY-MM-DD sem horário", () => {
  assert.equal(mapper.toDateOnly(new Date(Date.UTC(2026, 6, 21))), "2026-07-21");
  assert.equal(mapper.toDateOnly("2026-07-21T12:34:56.000Z"), "2026-07-21");
  assert.equal(mapper.toDateOnly("2026-07-21"), "2026-07-21");
  assert.equal(mapper.toDateOnly(null), null);
});

test("inferCompanyId usa ID_EMPRESA explícito quando presente", () => {
  assert.equal(mapper.inferCompanyId({ ORDER_ID_EMPRESA: 3 }), 3);
  assert.equal(mapper.inferCompanyId({ ORDER_ID_EMPRESA: 1 }), 1);
});

test("inferCompanyId cai em empresa 1 quando não há empresa explícita e grupo desconhecido", () => {
  assert.equal(mapper.inferCompanyId({}), 1);
  assert.equal(mapper.inferCompanyId({ CLIENTE_ID_GRUPO: 999 }), 1);
});

test("buildOrder converte números, remove espaços e monta arrays", () => {
  const orderRow = {
    ORDER_ID: 123,
    ORDER_NUMERO: 4567,
    ORDER_ID_EMPRESA: 1,
    ORDER_ID_STATUS: 2,
    ORDER_DT_ENTREGA: "2026-07-21",
    ORDER_OBSERVACAO: null,
    STATUS_NOME: "Confirmado   ",
    CLIENTE_ID: 100,
    CLIENTE_NOME_FANTASIA: null,
    PESSOA_NOME: "Cliente Exemplo   ",
    CLI_ENDERECO: "Rua Exemplo",
    CLI_NUMERO_END: "100",
    CLI_COMPLEMENTO: null,
    BAIRRO_NOME: "Centro",
    CIDADE_NOME: "Jaraguá do Sul",
    ESTADO_UF: "SC",
    CLI_CEP: null,
    CLI_REFERENCIA: null,
    CLI_TELEFONE: "47999999999",
  };
  const items = [
    { PRODUTO_ID: 10, PRODUTO_NOME: "Produto", QUANTIDADE: "2", UNIDADE: "UN" },
  ];
  const equip = [
    { TIPO_ID: 5, TIPO_NOME: "Chopeira elétrica", QUANTIDADE: 1 },
  ];
  const dto = mapper.buildOrder(orderRow, items, equip);
  assert.equal(dto.id, 123);
  assert.equal(dto.number, 4567);
  assert.equal(dto.companyId, 1);
  assert.deepEqual(dto.status, { id: 2, name: "Confirmado" });
  assert.equal(dto.customer.name, "Cliente Exemplo");
  assert.equal(dto.customer.phone, "47999999999");
  assert.equal(dto.delivery.date, "2026-07-21");
  assert.equal(dto.delivery.address.city, "Jaraguá do Sul");
  assert.equal(dto.items.length, 1);
  assert.equal(dto.items[0].quantity, 2);
  assert.equal(dto.items[0].unit, "UN");
  assert.equal(dto.equipment.length, 1);
  assert.equal(dto.equipment[0].quantity, 1);
});

test("buildOrder retorna items:[] e equipment:[] quando ausentes", () => {
  const dto = mapper.buildOrder({ ORDER_ID: 1, ORDER_ID_EMPRESA: 1 }, [], []);
  assert.deepEqual(dto.items, []);
  assert.deepEqual(dto.equipment, []);
});

test("buildOrder deduplica itens e equipamentos repetidos por join", () => {
  const items = [
    { PRODUTO_ID: 10, PRODUTO_NOME: "P", QUANTIDADE: 2, UNIDADE: "UN" },
    { PRODUTO_ID: 10, PRODUTO_NOME: "P", QUANTIDADE: 2, UNIDADE: "UN" },
    { PRODUTO_ID: 11, PRODUTO_NOME: "Q", QUANTIDADE: 1, UNIDADE: "UN" },
  ];
  const equip = [
    { TIPO_ID: 5, TIPO_NOME: "E", QUANTIDADE: 1 },
    { TIPO_ID: 5, TIPO_NOME: "E", QUANTIDADE: 1 },
  ];
  const dto = mapper.buildOrder(
    { ORDER_ID: 1, ORDER_ID_EMPRESA: 1 },
    items,
    equip,
  );
  assert.equal(dto.items.length, 2);
  assert.equal(dto.equipment.length, 1);
});

test("dedupeBy preserva ordem original de primeira ocorrência", () => {
  const r = mapper.dedupeBy([{ k: 1 }, { k: 2 }, { k: 1 }], (x) => x.k);
  assert.deepEqual(r, [{ k: 1 }, { k: 2 }]);
});