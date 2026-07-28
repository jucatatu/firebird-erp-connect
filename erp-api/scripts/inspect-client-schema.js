#!/usr/bin/env node
"use strict";
/**
 * Introspecção SOMENTE LEITURA do domínio de CLIENTES.
 * Uso: node scripts/inspect-client-schema.js
 * Nunca imprime dados pessoais — apenas metadados do catálogo.
 */
require("dotenv").config();
const { report, runScript, countRows, tableExists } = require("./lib/introspect");

const TABLES = [
  "CLIENTES", "PESSOAS", "GRUPO_CLIENTE", "CONTATO", "TIPO_CONTATO",
  "ENDERECO", "ESTADO", "CIDADE", "BAIRRO", "RUA", "VENDEDOR", "FUNCIONARIO",
];

const CONCEPTS = {
  "chave primária": ["ID_CLIENTE"],
  "vínculo pessoa": ["ID_PESSOA"],
  nome: ["NOME"],
  "fantasia/apelido": ["APELIDO", "FANTASIA", "NOME_FANTASIA"],
  cpf: ["CPF"],
  cnpj: ["CNPJ"],
  "documento secundário": ["RG", "IE", "INSCRICAO_ESTADUAL"],
  vendedor: ["ID_VENDEDOR", "ID_FUNCIONARIO", "ID_REPRESENTANTE"],
  empresa: ["ID_EMPRESA"],
  grupo: ["ID_GRUPO_CLIENTE"],
  "forma de pagamento": ["ID_FORMA_PAGAMENTO", "ID_FPGTO", "ID_FORMAPAGAMENTO"],
  "condição/prazo": ["ID_CONDICAO_PAGAMENTO", "ID_PRAZO", "ID_COND_PAGTO", "PRAZO"],
  "endereço cadastral": ["ID_RUA", "ID_BAIRRO", "ID_CIDADE", "ID_ESTADO", "NUMERO", "CEP"],
  "situação ativa": ["ATIVO", "SITUACAO", "INATIVO"],
  "exclusão lógica": ["DELETED"],
  "bloqueio comercial": ["BLOQUEADO", "BLOQUEIO", "BLOQUEADO_COMERCIAL"],
  "bloqueio financeiro": ["BLOQUEADO_FINANCEIRO", "BLOQUEIO_FINANCEIRO"],
  "motivo do bloqueio": ["MOTIVO_BLOQUEIO", "OBS_BLOQUEIO"],
};

runScript(async () => {
  const found = {};
  for (const t of TABLES) {
    // eslint-disable-next-line no-await-in-loop
    const r = await report(t);
    found[t] = r.columns;
  }
  console.log("\n=== MAPA DE CONCEITOS → COLUNAS CONFIRMADAS EM CLIENTES/PESSOAS");
  const pool = new Set([...(found.CLIENTES || []), ...(found.PESSOAS || [])]);
  for (const [concept, candidates] of Object.entries(CONCEPTS)) {
    const hits = candidates.filter((c) => pool.has(c));
    console.log(`  ${concept.padEnd(24)} ${hits.length ? hits.join(", ") : "NÃO ENCONTRADO"}`);
  }
  if (await tableExists("CLIENTES")) {
    console.log(`\n  total de clientes (agregado): ${await countRows("CLIENTES")}`);
  }
});
