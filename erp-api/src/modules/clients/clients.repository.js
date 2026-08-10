"use strict";

/**
 * Camada de acesso a dados do módulo Clients.
 *
 * TODAS as consultas são SOMENTE LEITURA e 100% parametrizadas.
 * Nenhuma entrada do usuário é interpolada em SQL: os únicos trechos
 * dinâmicos são nomes de coluna confirmados pela introspecção do catálogo
 * do próprio Firebird (RDB$RELATION_FIELDS) e validados como identificadores.
 */

const firebird = require("../../shared/database/firebird-client");
const introspection = require("../../shared/database/schema-introspection");
const operationsRepository = require("../operations/operations.repository");

/**
 * Candidatos por conceito. A PRIMEIRA coluna existente vence.
 * A lista é conservadora: nada é inventado no contrato — quando nenhum
 * candidato existe, o campo é devolvido como null pelo mapper.
 */
const CLIENT_COLUMN_CANDIDATES = Object.freeze({
  personId: ["ID_PESSOA"],
  companyId: ["ID_EMPRESA"],
  groupId: ["ID_GRUPO_CLIENTE"],
  sellerId: ["ID_VENDEDOR", "ID_FUNCIONARIO", "ID_REPRESENTANTE"],
  paymentMethodId: ["ID_FORMA_PAGAMENTO"],
  paymentTermId: ["ID_PRAZO"],
  saleTypeId: ["ID_OPERACAO"],
  active: ["ATIVO", "SITUACAO", "INATIVO"],
  deleted: ["DELETED"],
  blocked: ["BLOQUEADO", "BLOQUEIO", "BLOQUEADO_COMERCIAL"],
  blockedFinancial: ["BLOQUEADO_FINANCEIRO", "BLOQUEIO_FINANCEIRO"],
  blockReason: ["MOTIVO_BLOQUEIO", "OBS_BLOQUEIO"],
  code: ["CODIGO", "COD_CLIENTE"],
  stateId: ["ID_ESTADO"],
  cityId: ["ID_CIDADE"],
  districtId: ["ID_BAIRRO"],
  streetId: ["ID_RUA"],
  addressNumber: ["NUMERO"],
  addressComplement: ["COMPLEMENTO"],
  zip: ["CEP"],
});

const PERSON_COLUMN_CANDIDATES = Object.freeze({
  name: ["NOME"],
  tradeName: ["APELIDO", "FANTASIA", "NOME_FANTASIA"],
  cpf: ["CPF"],
  cnpj: ["CNPJ"],
  deleted: ["DELETED"],
});

let schemaPromise = null;

async function resolveMap(table, candidates) {
  const out = {};
  for (const [key, list] of Object.entries(candidates)) {
    // eslint-disable-next-line no-await-in-loop
    out[key] = await introspection.pickExistingColumn(table, list);
  }
  return out;
}

/**
 * Descobre, uma única vez por processo, quais colunas realmente existem.
 * @returns {Promise<{client: object, person: object, group: object}>}
 */
async function getSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const [client, person, groupDescription] = await Promise.all([
        resolveMap("CLIENTES", CLIENT_COLUMN_CANDIDATES),
        resolveMap("PESSOAS", PERSON_COLUMN_CANDIDATES),
        introspection.pickExistingColumn("GRUPO_CLIENTE", ["DESCRICAO", "NOME"]),
      ]);
      return { client, person, group: { description: groupDescription } };
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

function resetSchemaCache() {
  schemaPromise = null;
  introspection.clearCache();
}

/** `alias.COL AS OUT` para colunas confirmadas; entradas nulas são ignoradas. */
function selectIfPresent(alias, column, outAlias) {
  if (!column) return null;
  return `${alias}.${column} AS ${outAlias}`;
}

function buildSelectList(schema) {
  const c = schema.client;
  const p = schema.person;
  const parts = [
    "cl.ID_CLIENTE AS ID_CLIENTE",
    selectIfPresent("cl", c.personId, "ID_PESSOA"),
    selectIfPresent("cl", c.code, "CLIENTE_CODIGO"),
    selectIfPresent("cl", c.companyId, "CLIENTE_ID_EMPRESA"),
    selectIfPresent("cl", c.groupId, "ID_GRUPO_CLIENTE"),
    selectIfPresent("cl", c.sellerId, "ID_VENDEDOR"),
    selectIfPresent("cl", c.paymentMethodId, "ID_FORMA_PAGAMENTO"),
    selectIfPresent("cl", c.paymentTermId, "ID_PRAZO"),
    selectIfPresent("cl", c.saleTypeId, "ID_OPERACAO"),
    selectIfPresent("cl", c.active, "CLIENTE_ATIVO"),
    selectIfPresent("cl", c.deleted, "CLIENTE_DELETED"),
    selectIfPresent("cl", c.blocked, "CLIENTE_BLOQUEADO"),
    selectIfPresent("cl", c.blockedFinancial, "CLIENTE_BLOQUEADO_FIN"),
    selectIfPresent("cl", c.blockReason, "CLIENTE_MOTIVO_BLOQUEIO"),
    selectIfPresent("cl", c.addressNumber, "NUMERO"),
    selectIfPresent("cl", c.addressComplement, "COMPLEMENTO"),
    selectIfPresent("cl", c.zip, "CEP"),
    selectIfPresent("p", p.name, "CLIENTE_NOME"),
    selectIfPresent("p", p.tradeName, "CLIENTE_APELIDO"),
    selectIfPresent("p", p.cpf, "CPF"),
    selectIfPresent("p", p.cnpj, "CNPJ"),
    schema.group.description ? `gc.${schema.group.description} AS GRUPO_CLIENTE_DESCRICAO` : null,
    c.cityId ? "ci.NOME AS CIDADE" : null,
    c.districtId ? "b.NOME AS BAIRRO" : null,
    c.streetId ? "r.NOME AS RUA" : null,
    c.stateId ? "e.SIGLA AS UF" : null,
  ].filter(Boolean);
  return parts.join(",\n      ");
}

function buildJoins(schema) {
  const c = schema.client;
  const p = schema.person;
  const joins = [];
  if (c.personId && (p.name || p.cpf || p.cnpj)) {
    joins.push(`LEFT JOIN PESSOAS p ON cl.${c.personId} = p.ID_PESSOA`);
  }
  if (c.groupId && schema.group.description) {
    joins.push(`LEFT JOIN GRUPO_CLIENTE gc ON cl.${c.groupId} = gc.ID_GRUPO_CLIENTE`);
  }
  if (c.cityId) joins.push(`LEFT JOIN CIDADE ci ON cl.${c.cityId} = ci.ID_CIDADE`);
  if (c.districtId) joins.push(`LEFT JOIN BAIRRO b ON cl.${c.districtId} = b.ID_BAIRRO`);
  if (c.streetId) joins.push(`LEFT JOIN RUA r ON cl.${c.streetId} = r.ID_RUA`);
  if (c.stateId) joins.push(`LEFT JOIN ESTADO e ON cl.${c.stateId} = e.ID_ESTADO`);
  return joins.join("\n    ");
}

function buildInPlaceholders(n) {
  return Array.from({ length: n }, () => "?").join(", ");
}

/**
 * Busca paginada por keyset (ID_CLIENTE ASC), determinística e com teto.
 *
 * @param {{qPatterns?: string[], documentDigits?: string|null,
 *          cityPattern?: string|null, clientIdFilter?: number[]|null,
 *          companyId?: number|null,
 *          limit: number, cursor: number|null}} input
 */
async function searchClients(input) {
  const schema = await getSchema();
  const c = schema.client;
  const p = schema.person;

  const where = ["1 = 1"];
  const params = [];

  if (c.deleted) where.push(`(cl.${c.deleted} IS NULL OR cl.${c.deleted} = 0)`);
  if (p.deleted && c.personId) where.push(`(p.${p.deleted} IS NULL OR p.${p.deleted} = 0)`);

  if (input.cursor !== null && input.cursor !== undefined) {
    where.push("cl.ID_CLIENTE > ?");
    params.push(input.cursor);
  }

  if (Array.isArray(input.clientIdFilter)) {
    if (input.clientIdFilter.length === 0) return { rows: [], schema };
    where.push(`cl.ID_CLIENTE IN (${buildInPlaceholders(input.clientIdFilter.length)})`);
    params.push(...input.clientIdFilter);
  }

  if (input.qPatterns && input.qPatterns.length > 0) {
    const ors = [];
    for (const pattern of input.qPatterns) {
      if (p.name && c.personId) {
        ors.push(`UPPER(p.${p.name}) LIKE ?`);
        params.push(pattern);
      }
      if (p.tradeName && c.personId) {
        ors.push(`UPPER(p.${p.tradeName}) LIKE ?`);
        params.push(pattern);
      }
    }
    if (/^\d+$/.test(input.qRaw || "")) {
      ors.push("cl.ID_CLIENTE = ?");
      params.push(Number(input.qRaw));
      if (p.cpf && c.personId) {
        ors.push(`p.${p.cpf} LIKE ?`);
        params.push(`%${input.qRaw}%`);
      }
      if (p.cnpj && c.personId) {
        ors.push(`p.${p.cnpj} LIKE ?`);
        params.push(`%${input.qRaw}%`);
      }
    }
    if (ors.length === 0) return { rows: [], schema };
    where.push(`(${ors.join(" OR ")})`);
  }

  if (input.documentDigits) {
    const ors = [];
    if (p.cpf && c.personId) {
      ors.push(`p.${p.cpf} LIKE ?`);
      params.push(`%${input.documentDigits}%`);
    }
    if (p.cnpj && c.personId) {
      ors.push(`p.${p.cnpj} LIKE ?`);
      params.push(`%${input.documentDigits}%`);
    }
    if (ors.length === 0) return { rows: [], schema };
    where.push(`(${ors.join(" OR ")})`);
  }

  if (input.cityPattern && c.cityId) {
    where.push("UPPER(ci.NOME) LIKE ?");
    params.push(input.cityPattern);
  }

  if (input.companyId !== null && input.companyId !== undefined) {
    if (input.companyId === 3) {
      if (c.companyId && schema.group.description && c.groupId) {
        where.push(`(cl.${c.companyId} = 3 OR UPPER(gc.${schema.group.description}) LIKE '%GROTT%')`);
      } else if (c.companyId) {
        where.push(`cl.${c.companyId} = 3`);
      } else if (schema.group.description && c.groupId) {
        where.push(`UPPER(gc.${schema.group.description}) LIKE '%GROTT%'`);
      }
    } else {
      if (c.companyId && schema.group.description && c.groupId) {
        where.push(`(cl.${c.companyId} IS NULL OR cl.${c.companyId} <> 3)`);
        where.push(`(gc.${schema.group.description} IS NULL OR UPPER(gc.${schema.group.description}) NOT LIKE '%GROTT%')`);
      } else if (c.companyId) {
        where.push(`(cl.${c.companyId} IS NULL OR cl.${c.companyId} <> 3)`);
      } else if (schema.group.description && c.groupId) {
        where.push(`(gc.${schema.group.description} IS NULL OR UPPER(gc.${schema.group.description}) NOT LIKE '%GROTT%')`);
      }
    }
  }


  const sql = `
    SELECT
      ${buildSelectList(schema)}
    FROM CLIENTES cl
    ${buildJoins(schema)}
    WHERE ${where.join("\n      AND ")}
    ORDER BY cl.ID_CLIENTE ASC
    ROWS ?
  `;
  params.push(input.limit);

  const rows = (await firebird.executeQuery(sql, params)) || [];
  return { rows, schema };
}

/** Detalhe por chave primária. */
async function findClientById(clientId) {
  const schema = await getSchema();
  const sql = `
    SELECT
      ${buildSelectList(schema)}
    FROM CLIENTES cl
    ${buildJoins(schema)}
    WHERE cl.ID_CLIENTE = ?
    ROWS 1
  `;
  const rows = (await firebird.executeQuery(sql, [clientId])) || [];
  return { row: rows[0] || null, schema };
}

/** IDs de clientes cujo telefone contém os dígitos informados. */
async function findClientIdsByPhoneDigits(digits, limit) {
  const sql = `
    SELECT DISTINCT cl.ID_CLIENTE
    FROM CONTATO c
    JOIN CLIENTES cl ON c.ID_PESSOA = cl.ID_PESSOA
    WHERE (c.DELETED IS NULL OR c.DELETED = 0)
      AND c.DESCRICAO LIKE ?
    ORDER BY cl.ID_CLIENTE ASC
    ROWS ?
  `;
  const rows = (await firebird.executeQuery(sql, [`%${digits}%`, limit])) || [];
  return rows;
}

/**
 * Telefones em lote — REUTILIZA a consulta oficial do módulo operations
 * (prioridade CELULAR → FONE). Evita N+1 e evita duplicar a regra.
 */
async function findPhonesByClientIds(clientIds) {
  return operationsRepository.findPhonesByClientIds(clientIds);
}

/**
 * Endereço do ÚLTIMO pedido do cliente — usado apenas como fallback quando
 * o cadastro não possui endereço estruturado. A origem é sinalizada no
 * contrato como "last_order".
 */
async function findLastOrderAddressByClientIds(clientIds) {
  if (!clientIds || clientIds.length === 0) return [];
  const placeholders = buildInPlaceholders(clientIds.length);
  const sql = `
    SELECT
      ov.ID_CLIENTE,
      ov.ID_ORDENS_VENDA,
      ov.NUMERO,
      ov.COMPLEMENTO,
      ci.NOME  AS CIDADE,
      b.NOME   AS BAIRRO,
      r.NOME   AS RUA,
      e.SIGLA  AS UF
    FROM ORDENS_VENDA ov
    LEFT JOIN CIDADE ci ON ov.ID_CIDADE = ci.ID_CIDADE
    LEFT JOIN BAIRRO b  ON ov.ID_BAIRRO = b.ID_BAIRRO
    LEFT JOIN RUA    r  ON ov.ID_RUA = r.ID_RUA
    LEFT JOIN ESTADO e  ON ov.ID_ESTADO = e.ID_ESTADO
    WHERE ov.ID_CLIENTE IN (${placeholders})
      AND (ov.DELETED IS NULL OR ov.DELETED = 0)
    ORDER BY ov.ID_CLIENTE, ov.ID_ORDENS_VENDA DESC
  `;
  return (await firebird.executeQuery(sql, clientIds)) || [];
}

module.exports = {
  getSchema,
  resetSchemaCache,
  searchClients,
  findClientById,
  findClientIdsByPhoneDigits,
  findPhonesByClientIds,
  findLastOrderAddressByClientIds,
  CLIENT_COLUMN_CANDIDATES,
  PERSON_COLUMN_CANDIDATES,
  _internal: { buildSelectList, buildJoins, selectIfPresent, buildInPlaceholders },
};
