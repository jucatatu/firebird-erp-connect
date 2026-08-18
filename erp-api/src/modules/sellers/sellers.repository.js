"use strict";

const firebird = require("../../shared/database/firebird-client");

/**
 * Busca vendedores no Firebird usando o schema homologado.
 */
async function searchSellers({ query = "", limit = 50, companyId = null }) {
  const params = [];
  let sql = `
    SELECT FIRST ?
        c.ID_COLABORADORES AS ID_VENDEDOR,
        c.ID_EMPRESA AS ID_EMPRESA,
        p.NOME AS NOME,
        p.APELIDO AS APELIDO
    FROM COLABORADORES c
    JOIN PESSOAS p ON p.ID_PESSOA = c.ID_PESSOA
    WHERE c.IS_VENDEDOR = 1
      AND c.ID_EMPRESA IN (1, 3)
  `;

  params.push(limit);

  if (query && query.trim()) {
    const searchTerm = `%${query.trim().toUpperCase()}%`;
    sql += ` AND (UPPER(p.NOME) LIKE ? OR UPPER(p.APELIDO) LIKE ?)`;
    params.push(searchTerm, searchTerm);
  }

  if (companyId) {
    sql += ` AND c.ID_EMPRESA = ?`;
    params.push(companyId);
  }

  sql += ` ORDER BY p.NOME ASC`;

  const rows = await firebird.executeQuery(sql, params);

  return rows.map(row => ({
    id: row.ID_VENDEDOR,
    name: row.NOME ? row.NOME.trim() : "",
    nickname: row.APELIDO ? row.APELIDO.trim() : null,
    companyId: row.ID_EMPRESA
  }));
}

/**
 * Busca um vendedor específico por ID.
 */
async function getSellerById(id) {
  const sql = `
    SELECT
        c.ID_COLABORADORES AS ID_VENDEDOR,
        c.ID_EMPRESA AS ID_EMPRESA,
        p.NOME AS NOME,
        p.APELIDO AS APELIDO
    FROM COLABORADORES c
    JOIN PESSOAS p ON p.ID_PESSOA = c.ID_PESSOA
    WHERE c.ID_COLABORADORES = ?
      AND c.IS_VENDEDOR = 1
      AND c.ID_EMPRESA IN (1, 3)
  `;

  const rows = await firebird.executeQuery(sql, [id]);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.ID_VENDEDOR,
    name: row.NOME ? row.NOME.trim() : "",
    nickname: row.APELIDO ? row.APELIDO.trim() : null,
    companyId: row.ID_EMPRESA
  };
}

module.exports = { searchSellers, getSellerById };
