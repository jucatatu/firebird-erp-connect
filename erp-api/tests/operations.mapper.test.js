"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");

const mapper = require("../src/modules/operations/operations.mapper");

test("pick aceita chave exata, maiúscula e minúscula", () => {
  assert.equal(mapper.pick({ N_PEDIDO: 123 }, "N_PEDIDO"), 123);
  assert.equal(mapper.pick({ n_pedido: 123 }, "N_PEDIDO"), 123);
  assert.equal(mapper.pick({ N_pedido: 123 }, "N_pedido"), 123);
});

test("toNullableString remove espaços e preserva acentos já decodificados", () => {
  assert.equal(mapper.toNullableString("Jaraguá do Sul   "), "Jaraguá do Sul");
  assert.equal(mapper.toNullableString("   "), null);
  assert.equal(mapper.toNullableString(""), null);
  assert.equal(mapper.toNullableString(null), null);
});

test("toDateOnly retorna YYYY-MM-DD sem horário", () => {
  assert.equal(mapper.toDateOnly(new Date(Date.UTC(2026, 6, 21))), "2026-07-21");
  assert.equal(mapper.toDateOnly("2026-07-21T12:34:56.000Z"), "2026-07-21");
  assert.equal(mapper.toDateOnly("2026-07-21"), "2026-07-21");
  assert.equal(mapper.toDateOnly(null), null);
});

test("buildOrder mapeia contrato completo com nome, endereço, datas e status", () => {
  const row = {
    ID_ORDENS_VENDA: 500,
    N_PEDIDO: 4567,
    ID_CLIENTE: 100,
    DATA_PREV_ENTREGA: "2026-07-21",
    DATA_PREV_RETORNO: "2026-07-25",
    OBS: "Entregar após 14h",
    NUMERO: "100",
    COMPLEMENTO: "Sala 2",
    CLIENTE_NOME: "Cliente Exemplo",
    CLIENTE_APELIDO: "Apelido",
    UF: "SC",
    CIDADE: "Jaraguá do Sul",
    BAIRRO: "Centro",
    RUA: "Rua Exemplo",
    STATUS_DESCRICAO: "Confirmado",
  };
  const dto = mapper.buildOrder(row, "47999999999", [], []);
  assert.equal(dto.orderId, 500);
  assert.equal(dto.orderNumber, "4567");
  assert.equal(typeof dto.orderNumber, "string");
  assert.equal(dto.clientId, 100);
  assert.equal(dto.clientName, "Cliente Exemplo");
  assert.equal(dto.phone, "47999999999");
  assert.equal(dto.expectedDelivery, "2026-07-21");
  assert.equal(dto.expectedReturn, "2026-07-25");
  assert.equal(dto.observations, "Entregar após 14h");
  assert.equal(dto.erpStatus, "Confirmado");
  assert.equal(dto.companyId, 1);
  assert.deepEqual(dto.address, {
    street: "Rua Exemplo",
    number: "100",
    complement: "Sala 2",
    neighborhood: "Centro",
    city: "Jaraguá do Sul",
    state: "SC",
  });
  assert.deepEqual(dto.items, []);
  assert.deepEqual(dto.equipments, []);
});

test("clientName usa CLIENTE_NOME antes de CLIENTE_APELIDO", () => {
  const dto = mapper.buildOrder({ CLIENTE_APELIDO: "Só apelido" }, null, [], []);
  assert.equal(dto.clientName, "Só apelido");
  const dto2 = mapper.buildOrder(
    { CLIENTE_NOME: "Nome", CLIENTE_APELIDO: "Apelido" },
    null,
    [],
    [],
  );
  assert.equal(dto2.clientName, "Nome");
  const dto3 = mapper.buildOrder({}, null, [], []);
  assert.equal(dto3.clientName, "");
});

test("phone null quando cliente sem telefone", () => {
  const dto = mapper.buildOrder({ ID_ORDENS_VENDA: 1 }, null, [], []);
  assert.equal(dto.phone, null);
});

test("items preservam campos e NÃO são deduplicados", () => {
  const rows = [
    {
      ID_PRODUTO: 10,
      PRODUTO: "Chopp Pilsen",
      QUANTIDADE: 2,
      VALOR_UNITARIO: 15.5,
      VALOR_TOTAL: 31,
    },
    {
      ID_PRODUTO: 10,
      PRODUTO: "Chopp Pilsen",
      QUANTIDADE: 2,
      VALOR_UNITARIO: 15.5,
      VALOR_TOTAL: 31,
    },
    {
      ID_PRODUTO: 11,
      PRODUTO: "Chopp IPA",
      QUANTIDADE: 1,
      VALOR_UNITARIO: 20,
      VALOR_TOTAL: 20,
    },
  ];
  const dto = mapper.buildOrder({ ID_ORDENS_VENDA: 1 }, null, rows, []);
  assert.equal(dto.items.length, 3);
  assert.deepEqual(dto.items[0], {
    productId: 10,
    product: "Chopp Pilsen",
    quantity: 2,
    unitPrice: 15.5,
    total: 31,
  });
});

test("equipments preservam campos e NÃO são deduplicados", () => {
  const rows = [
    { ID_TIPO_EQUIPAMENTO: 5, TIPO: "Chopeira", QUANTIDADE: 1 },
    { ID_TIPO_EQUIPAMENTO: 5, TIPO: "Chopeira", QUANTIDADE: 1 },
  ];
  const dto = mapper.buildOrder({ ID_ORDENS_VENDA: 1 }, null, [], rows);
  assert.equal(dto.equipments.length, 2);
  assert.deepEqual(dto.equipments[0], {
    typeId: 5,
    type: "Chopeira",
    quantity: 1,
  });
});

test("mapper aceita linhas em lower-case (variações do driver)", () => {
  const row = {
    id_ordens_venda: 7,
    n_pedido: 99,
    id_cliente: 3,
    cliente_nome: "Nome Lower",
    rua: "Rua Baixa",
    numero: "10",
    complemento: "",
    bairro: "Bairro X",
    cidade: "Cidade Y",
    uf: "SC",
  };
  const dto = mapper.buildOrder(row, null, [], []);
  assert.equal(dto.orderId, 7);
  assert.equal(dto.orderNumber, "99");
  assert.equal(dto.clientName, "Nome Lower");
  assert.equal(dto.address.city, "Cidade Y");
});

test("resolveCompanyId: prioridade ORDENS_VENDA sobre CLIENTES", () => {
  assert.equal(mapper.resolveCompanyId({ ORDEM_ID_EMPRESA: 3, CLIENTE_ID_EMPRESA: 1 }), 3);
  assert.equal(mapper.resolveCompanyId({ ORDEM_ID_EMPRESA: 1, CLIENTE_ID_EMPRESA: 3 }), 1);
});

test("resolveCompanyId: fallback para CLIENTES quando ordem é null", () => {
  assert.equal(
    mapper.resolveCompanyId({ ORDEM_ID_EMPRESA: null, CLIENTE_ID_EMPRESA: 3 }),
    3,
  );
  assert.equal(
    mapper.resolveCompanyId({ ORDEM_ID_EMPRESA: null, CLIENTE_ID_EMPRESA: 1 }),
    1,
  );
});

test("resolveCompanyId: fallback grupo GROTT → 3 (case-insensitive)", () => {
  assert.equal(
    mapper.resolveCompanyId({
      ORDEM_ID_EMPRESA: null,
      CLIENTE_ID_EMPRESA: null,
      GRUPO_CLIENTE_DESCRICAO: "PONTO DE VENDA - GROTT",
    }),
    3,
  );
  assert.equal(
    mapper.resolveCompanyId({ GRUPO_CLIENTE_DESCRICAO: "revenda grott centro" }),
    3,
  );
});

test("resolveCompanyId: default Graal quando não há evidência de GROTT", () => {
  assert.equal(
    mapper.resolveCompanyId({ GRUPO_CLIENTE_DESCRICAO: "CLIENTES GERAIS" }),
    1,
  );
  assert.equal(mapper.resolveCompanyId({}), 1);
  assert.equal(
    mapper.resolveCompanyId({
      ORDEM_ID_EMPRESA: null,
      CLIENTE_ID_EMPRESA: null,
      GRUPO_CLIENTE_DESCRICAO: null,
    }),
    1,
  );
});

test("resolveCompanyId: CLIENTES e ORDEM prevalecem sobre grupo GROTT", () => {
  assert.equal(
    mapper.resolveCompanyId({
      ORDEM_ID_EMPRESA: null,
      CLIENTE_ID_EMPRESA: 1,
      GRUPO_CLIENTE_DESCRICAO: "GROTT VAREJO",
    }),
    1,
  );
  assert.equal(
    mapper.resolveCompanyId({
      ORDEM_ID_EMPRESA: 1,
      CLIENTE_ID_EMPRESA: 3,
      GRUPO_CLIENTE_DESCRICAO: "GROTT VAREJO",
    }),
    1,
  );
});

test("resolveCompanyId: valores fora de {1,3} são ignorados", () => {
  // ORDEM=99 inválido, cliente null, grupo comum → default 1
  assert.equal(
    mapper.resolveCompanyId({
      ORDEM_ID_EMPRESA: 99,
      CLIENTE_ID_EMPRESA: null,
      GRUPO_CLIENTE_DESCRICAO: "COMUM",
    }),
    1,
  );
  // ORDEM=99 inválido, cliente=3 → 3 (avança para próximo nível)
  assert.equal(
    mapper.resolveCompanyId({ ORDEM_ID_EMPRESA: 99, CLIENTE_ID_EMPRESA: 3 }),
    3,
  );
});

test("resolveCompanyId: nunca retorna null", () => {
  const cases = [
    {},
    { ORDEM_ID_EMPRESA: null, CLIENTE_ID_EMPRESA: null, GRUPO_CLIENTE_DESCRICAO: null },
    { ORDEM_ID_EMPRESA: "", CLIENTE_ID_EMPRESA: "" },
    { GRUPO_CLIENTE_DESCRICAO: "" },
    { ORDEM_ID_EMPRESA: 42 },
  ];
  for (const row of cases) {
    const r = mapper.resolveCompanyId(row);
    assert.ok(r === 1 || r === 3, `expected 1 or 3, got ${r}`);
  }
});

test("buildOrder usa companyId resolvido pela regra oficial", () => {
  const dto = mapper.buildOrder(
    { ID_ORDENS_VENDA: 1, ORDEM_ID_EMPRESA: 3 },
    null,
    [],
    [],
  );
  assert.equal(dto.companyId, 3);
  const dto2 = mapper.buildOrder({ ID_ORDENS_VENDA: 2 }, null, [], []);
  assert.equal(dto2.companyId, 1);
});