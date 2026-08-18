"use strict";

function toErpSeller(row) {
  if (!row) return null;
  return {
    id: row.ID_VENDEDOR || row.id_vendedor || row.ID || row.id || 0,
    name: (row.NOME || row.nome || row.DESCRICAO || row.descricao || row.NOME_VENDEDOR || "").toString().trim(),
    active: row.ATIVO === "S" || row.ativo === "S" || row.SITUACAO === 1 || true
  };
}

module.exports = { toErpSeller };
