#!/usr/bin/env node
"use strict";

/**
 * SPRINT 7.1 — HOMOLOGAÇÃO REAL DA CRIAÇÃO DE PEDIDOS
 * 
 * Este script executa a pré-validação técnica no Firebird (somente leitura)
 * e gera o roteiro de execução para o servidor Windows.
 */

require("dotenv").config();
const { readOnlyQuery, typeName, runScript } = require("./lib/introspect");

const ROOT_PROCS = [
  "SP_CAD_ORDEM_VENDA_COMPLETO",
  "SP_CAD_ITENS_ORDENS_VENDA",
  "SP_CAD_EQUIP_ORDENS_VENDA",
];

async function main() {
  console.log("# SPRINT 7.1 — RELATÓRIO DE PRÉ-VALIDAÇÃO TÉCNICA (FIREBIRD)");
  console.log(`Data: ${new Date().toISOString()}\n`);

  console.log("## 1. ASSINATURA DAS PROCEDURES");
  for (const name of ROOT_PROCS) {
    const params = await readOnlyQuery(
      `
        SELECT
          pp.RDB$PARAMETER_NUMBER     AS PNUM,
          TRIM(pp.RDB$PARAMETER_NAME) AS PNAME,
          pp.RDB$PARAMETER_TYPE       AS PTYPE,
          f.RDB$FIELD_TYPE            AS FIELD_TYPE,
          f.RDB$FIELD_LENGTH          AS FIELD_LENGTH,
          f.RDB$FIELD_SCALE           AS FIELD_SCALE
        FROM RDB$PROCEDURE_PARAMETERS pp
        JOIN RDB$FIELDS f ON pp.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
        WHERE pp.RDB$PROCEDURE_NAME = ?
        ORDER BY pp.RDB$PARAMETER_TYPE, pp.RDB$PARAMETER_NUMBER
      `,
      [name]
    );

    console.log(`\n### ${name}`);
    if (!params.length) {
      console.log("- **ERRO: Procedure não encontrada ou sem parâmetros.**");
      continue;
    }

    const inputs = params.filter(p => Number(p.PTYPE) === 0);
    const outputs = params.filter(p => Number(p.PTYPE) !== 0);

    console.log("\n**Entrada:**");
    inputs.forEach(p => console.log(`${String(p.PNUM).padStart(2)} | ${p.PNAME.padEnd(30)} | ${typeName(p)}`));
    
    if (outputs.length) {
      console.log("\n**Saída:**");
      outputs.forEach(p => console.log(`${String(p.PNUM).padStart(2)} | ${p.PNAME.padEnd(30)} | ${typeName(p)}`));
    }
  }

  console.log("\n## 2. USUÁRIO TÉCNICO (ID_USER = 2)");
  const users = await readOnlyQuery(
    "SELECT FIRST 1 ID_USUARIO, TRIM(NOME) AS NOME, STATUS FROM USUARIOS WHERE ID_USUARIO = 2"
  );
  if (users.length) {
    const u = users[0];
    console.log(`- ID: ${u.ID_USUARIO}`);
    console.log(`- Nome: ${u.NOME}`);
    console.log(`- Status: ${u.STATUS === 'A' ? 'Ativo' : u.STATUS}`);
  } else {
    console.log("- **ERRO: Usuário ID 2 não encontrado.**");
  }

  console.log("\n## 3. ROTEIRO DE HOMOLOGAÇÃO REAL (A EXECUTAR NO SERVIDOR)");
  console.log("\nSe o ambiente Lovable não possui acesso direto ao Firebird real, execute os seguintes passos no servidor Windows:\n");
  
  console.log("### A. PAYLOAD DE TESTE (POST /api/v1/orders)");
  console.log("```json");
  console.log(JSON.stringify({
    companyId: 1,
    clientId: "[ID_CLIENTE_TESTE_REAL]",
    sellerId: 2,
    saleTypeId: 1,
    paymentTermId: 1,
    paymentMethodId: 1,
    deliver: true,
    deliveryAt: "2026-08-15T10:00:00-03:00",
    items: [{ productId: "[ID_PRODUTO_REAL]", quantity: 1 }],
    notes: "HOMOLOGACAO SPRINT 7.1 - NODE API"
  }, null, 2));
  console.log("```");

  console.log("\n### B. COMANDO CURL");
  console.log("```bash");
  console.log("curl -X POST http://localhost:8080/api/v1/orders \\");
  console.log("  -H 'Content-Type: application/json' \\");
  console.log("  -H 'X-API-Key: [SUA_CHAVE]' \\");
  console.log("  -H 'Idempotency-Key: test-homolog-001' \\");
  console.log("  -d '@payload.json'");
  console.log("```");

  console.log("\n### C. SQL DE CONFERÊNCIA (SOMENTE LEITURA)");
  console.log("```sql");
  console.log("-- 1. Cabeçalho e flags");
  console.log("SELECT ID_ORDENS_VENDA, N_PEDIDO, ID_EMPRESA, ID_CLIENTE, ID_STATUS, GERA_COBRANCA, SAIDA_ESTOQUE, DATA_EMISSAO ");
  console.log("FROM ORDENS_VENDA WHERE N_PEDIDO = [RETORNO_DO_CURL];");
  console.log("\n-- 2. Itens e Preços");
  console.log("SELECT ID_PRODUTO, QUANTIDADE, PRECO_UNITARIO, TOTAL_ITEM ");
  console.log("FROM ITENS_ORDENS_VENDA WHERE ID_ORDENS_VENDA = [ID_RETORNADO];");
  console.log("```");
}

runScript(main);
