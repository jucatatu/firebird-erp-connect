
import { searchErpProducts } from "./src/lib/erp.functions.ts";
import { z } from "zod";

async function test() {
  console.log("--- TESTE AUDITORIA SPRINT 8.5.5 ---");

  const testCases = [
    { q: "Ipa", isAdminSearch: true, expected: 200, label: "Busca válida 3 chars" },
    { q: "Pil", isAdminSearch: true, expected: 200, label: "Busca válida 3 chars (Pil)" },
    { q: "Pilsen", isAdminSearch: true, expected: 200, label: "Busca válida longa" },
    { q: "Ip", isAdminSearch: true, expected: "error", label: "Busca inválida 2 chars (deve falhar no validator do App)" },
    { q: "", isAdminSearch: true, expected: 200, label: "Busca vazia administrativa (short-circuit)" },
  ];

  for (const tc of testCases) {
    console.log(`\nTESTANDO: ${tc.label} (q="${tc.q}")`);
    try {
      const res = await searchErpProducts({ data: { q: tc.q, companyId: 1, limit: 50, isAdminSearch: tc.isAdminSearch } });
      console.log(`STATUS: ${res.status}`);
      if (res.error) console.log(`ERRO: ${res.error.code} - ${res.error.message}`);
      else console.log(`OK: ${res.data?.products?.length || 0} produtos.`);
    } catch (e: any) {
      console.log(`EXCEÇÃO: ${e.message}`);
    }
  }
}

test();
