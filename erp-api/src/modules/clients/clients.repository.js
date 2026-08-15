"use strict";

/**
 * Camada de acesso a dados do módulo Clients.
 */

const firebird = require("../../shared/database/firebird-client");
const { accentInsensitiveSqlExpression } = require("../../shared/search/like-pattern");
const introspection = require("../../shared/database/schema-introspection");
const operationsRepository = require("../operations/operations.repository");

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
  cpfCnpj: ["CPF_CNPJ"], // Sprint 8.9.42: Schema real confirmado
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
    selectIfPresent("p", p.cpfCnpj, "CPF_CNPJ"), // Sprint 8.9.42
    selectIfPresent("p", p.cpf, "CPF"),
    selectIfPresent("p", p.cnpj, "CNPJ"),
    schema.group.description ? `gc.${schema.group.description} AS GRUPO_CLIENTE_DESCRICAO` : null,
    // Endereço Estruturado (SP_CAD_CLIENTE_COMPLETO grava aqui)
    "ci.NOME AS CIDADE",
    "b.NOME AS BAIRRO",
    "r.NOME AS RUA",
    "e.SIGLA AS UF",
  ].filter(Boolean);
  return parts.join(",\n      ");
}

function buildJoins(schema) {
  const c = schema.client;
  const p = schema.person;
  const joins = [];
  if (c.personId && (p.name || p.cpf || p.cnpj || p.cpfCnpj)) {
    joins.push(`LEFT JOIN PESSOAS p ON cl.${c.personId} = p.ID_PESSOA`);
  }
  if (c.groupId && schema.group.description) {
    joins.push(`LEFT JOIN GRUPO_CLIENTE gc ON cl.${c.groupId} = gc.ID_GRUPO_CLIENTE`);
  }
  
  // Joins de endereço - SP_CAD_CLIENTE_COMPLETO usa as tabelas oficiais
  // O ID_PESSOA em CLIENTES aponta para o ID_PESSOA em ENDERECO
  joins.push(`LEFT JOIN ENDERECO ad ON p.ID_PESSOA = ad.ID_PESSOA`);
  joins.push(`LEFT JOIN CIDADE ci ON ad.ID_CIDADE = ci.ID_CIDADE`);
  joins.push(`LEFT JOIN BAIRRO b  ON ad.ID_BAIRRO = b.ID_BAIRRO`);
  joins.push(`LEFT JOIN RUA    r  ON ad.ID_RUA = r.ID_RUA`);
  joins.push(`LEFT JOIN ESTADO e  ON ad.ID_ESTADO = e.ID_ESTADO`);
  
  return joins.join("\n    ");
}

function buildInPlaceholders(n) {
  return Array.from({ length: n }, () => "?").join(", ");
}

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
        ors.push(`${accentInsensitiveSqlExpression(`p.${p.name}`)} LIKE ?`);
        params.push(pattern);
      }
      if (p.tradeName && c.personId) {
        ors.push(`${accentInsensitiveSqlExpression(`p.${p.tradeName}`)} LIKE ?`);
        params.push(pattern);
      }
    }
    if (/^\d+$/.test(input.qRaw || "")) {
      ors.push("cl.ID_CLIENTE = ?");
      params.push(Number(input.qRaw));
      
      if (p.cpfCnpj && c.personId) {
        ors.push(`p.${p.cpfCnpj} LIKE ?`);
        params.push(`%${input.qRaw}%`);
      }
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
    if (p.cpfCnpj && c.personId) {
      ors.push(`p.${p.cpfCnpj} = ?`);
      params.push(input.documentDigits);
    }
    if (p.cpf && c.personId) {
      ors.push(`p.${p.cpf} = ?`);
      params.push(input.documentDigits);
    }
    if (p.cnpj && c.personId) {
      ors.push(`p.${p.cnpj} = ?`);
      params.push(input.documentDigits);
    }
    if (ors.length === 0) return { rows: [], schema };
    where.push(`(${ors.join(" OR ")})`);
  }

  if (input.cityPattern) {
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

async function findPhonesByClientIds(clientIds) {
  return operationsRepository.findPhonesByClientIds(clientIds);
}

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

/** Duplicidade por documento (CPF_CNPJ). */
async function findClientByDocument(documentDigits) {
  const schema = await getSchema();
  const p = schema.person;
  const c = schema.client;
  
  const where = [];
  const params = [];

  const ors = [];
  if (p.cpfCnpj) {
    ors.push(`p.${p.cpfCnpj} = ?`);
    params.push(documentDigits);
  }
  if (p.cpf) {
    ors.push(`p.${p.cpf} = ?`);
    params.push(documentDigits);
  }
  if (p.cnpj) {
    ors.push(`p.${p.cnpj} = ?`);
    params.push(documentDigits);
  }
  
  if (ors.length === 0) return null;
  where.push(`(${ors.join(" OR ")})`);
  
  if (c.deleted) where.push(`(cl.${c.deleted} IS NULL OR cl.${c.deleted} = 0)`);
  if (p.deleted) where.push(`(p.${p.deleted} IS NULL OR p.${p.deleted} = 0)`);

  const sql = `
    SELECT
      cl.ID_CLIENTE AS ID_CLIENTE,
      ${selectIfPresent("cl", c.companyId, "CLIENTE_ID_EMPRESA")},
      ${selectIfPresent("p", p.name, "CLIENTE_NOME")},
      ${selectIfPresent("p", p.tradeName, "CLIENTE_APELIDO")},
      ${selectIfPresent("p", p.cpfCnpj, "CPF_CNPJ")},
      ${selectIfPresent("p", p.cpf, "CPF")},
      ${selectIfPresent("p", p.cnpj, "CNPJ")}
    FROM CLIENTES cl
    JOIN PESSOAS p ON cl.ID_PESSOA = p.ID_PESSOA
    WHERE ${where.join(" AND ")}
    ORDER BY cl.ID_CLIENTE DESC
    ROWS 1
  `;
  
  const rows = await firebird.executeQuery(sql, params);
  return rows[0] || null;
}

/**
 * Cadastro Atômico de Cliente + Contatos.
 */
async function createClientTransaction(clientParams, contactParams) {
  return firebird.withTransaction(async (tx) => {
    // 1. Procedure Oficial de Cadastro Completo
    // A SP_CAD_CLIENTE_COMPLETO possui outputs ID e ID_PES e possui SUSPEND.
    // Usamos o padrão SELECT para garantir a captura dos outputs no node-firebird.
    const spClient = `
      SELECT
        ID,
        ID_PES
      FROM SP_CAD_CLIENTE_COMPLETO(
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `;

    const rows = await tx.query(spClient, clientParams);
    const row = rows?.[0];

    // Extração defensiva dos IDs (pode vir em camelCase ou UPPER dependendo da config do driver)
    const clientId = Number(row?.ID ?? row?.id);
    const personId = Number(row?.ID_PES ?? row?.id_pes);

    if (!Number.isFinite(clientId) || clientId <= 0 || !Number.isFinite(personId) || personId <= 0) {
      const err = new Error("Falha ao obter IDs do novo cliente (Firebird SP return invalid)");
      err.code = "CLIENT_PROCEDURE_INVALID_RETURN";
      throw err;
    }

    // 2. Cadastro de Contatos
    const spContact = `EXECUTE PROCEDURE SP_CAD_CONTATOS(?, ?, ?, ?, ?)`;
    
    // Evitar mutação de contactParams (boa prática)
    const finalContactParams = [
      personId,
      contactParams[1],
      contactParams[2],
      contactParams[3],
      contactParams[4]
    ];

    await tx.query(spContact, finalContactParams);

    return { clientId, personId };
  });
}

module.exports = {
  getSchema,
  resetSchemaCache,
  searchClients,
  findClientById,
  findClientIdsByPhoneDigits,
  findPhonesByClientIds,
  findLastOrderAddressByClientIds,
  findClientByDocument,
  createClientTransaction,
  CLIENT_COLUMN_CANDIDATES,
  PERSON_COLUMN_CANDIDATES,
  _internal: { buildSelectList, buildJoins, selectIfPresent, buildInPlaceholders },
};
