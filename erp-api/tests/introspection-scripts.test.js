"use strict";

require("./helpers/env");

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { assertReadOnly, runScript } = require("../scripts/lib/introspect");

test("assertReadOnly aceita apenas SELECT", () => {
  assert.ok(assertReadOnly("SELECT 1 FROM RDB$DATABASE"));
  for (const sql of [
    "INSERT INTO CLIENTES (NOME) VALUES ('x')",
    "UPDATE CLIENTES SET NOME = 'x'",
    "DELETE FROM CLIENTES",
    "DROP TABLE CLIENTES",
    "EXECUTE PROCEDURE SP_CAD_ORDEM_VENDA",
    "  create table t(a int)",
  ]) {
    assert.throws(() => assertReadOnly(sql), /read_only_violation/, sql);
  }
});

test("assertReadOnly bloqueia escrita escondida dentro de um SELECT", () => {
  assert.throws(
    () => assertReadOnly("SELECT 1 FROM RDB$DATABASE; DELETE FROM CLIENTES"),
    /read_only_violation/,
  );
});

test("nenhum script de introspecção contém SQL de escrita", () => {
  const dir = path.resolve(__dirname, "../scripts");
  const files = fs.readdirSync(dir).filter((f) => f.startsWith("inspect-") || f.startsWith("diagnose-"));
  assert.ok(files.length >= 5, `esperado ao menos 5 scripts, obtido ${files.length}`);
  const forbidden = /\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP\s+|ALTER\s+|CREATE\s+TABLE|EXECUTE\s+PROCEDURE)\b/i;
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    const sqlish = src.replace(/^\s*\*.*$/gm, "").replace(/\/\/.*$/gm, "");
    assert.ok(!forbidden.test(sqlish), `${f} contém SQL de escrita`);
  }
});

test("runScript permite encerramento natural em caso de sucesso", async () => {
  const originalExit = process.exit;
  const originalExitCode = process.exitCode;
  let exitCalled = false;

  process.exit = () => {
    exitCalled = true;
    throw new Error("process.exit não deveria ser chamado");
  };
  process.exitCode = undefined;

  try {
    let executed = false;
    await runScript(async () => {
      executed = true;
    });

    assert.equal(executed, true);
    assert.equal(exitCalled, false);
    assert.equal(process.exitCode, undefined);
  } finally {
    process.exit = originalExit;
    process.exitCode = originalExitCode;
  }
});

test("runScript define exitCode 1 e sanitiza erro sem encerrar o processo", async () => {
  const originalExit = process.exit;
  const originalExitCode = process.exitCode;
  const originalConsoleError = console.error;
  let exitCalled = false;
  let logged = "";

  process.exit = () => {
    exitCalled = true;
    throw new Error("process.exit não deveria ser chamado");
  };
  process.exitCode = undefined;
  console.error = (message) => {
    logged += String(message);
  };

  try {
    await runScript(async () => {
      throw new Error(
        "Falha SELECT * FROM CLIENTES host=10.0.0.1 database=C:\\ERP\\DADOS\\ERP.FDB password=masterkey",
      );
    });

    assert.equal(exitCalled, false);
    assert.equal(process.exitCode, 1);
    assert.match(logged, /^ERRO:/);
    assert.doesNotMatch(logged, /SELECT|CLIENTES|10\.0\.0\.1|ERP\.FDB|masterkey|C:\\ERP/i);
  } finally {
    process.exit = originalExit;
    process.exitCode = originalExitCode;
    console.error = originalConsoleError;
  }
});
