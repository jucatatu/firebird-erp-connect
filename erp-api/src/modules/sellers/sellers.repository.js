"use strict";

/**
 * Módulo de Vendedores ERP.
 * STATUS: SELLERS PENDENTE DE HOMOLOGAÇÃO FIREBIRD.
 * 
 * Este módulo não deve executar SQL baseado em nomes presumidos (VENDEDORES, FUNCIONARIOS)
 * até que o schema seja comprovado via introspecção de metadados.
 */

async function searchSellers(query = "", limit = 50) {
  // Retorna erro controlado conforme o plano para evitar SQL inventado.
  const err = new Error("SELLER_SCHEMA_NOT_DISCOVERED");
  err.code = "SELLER_SCHEMA_NOT_DISCOVERED";
  throw err;
}

module.exports = { searchSellers };

