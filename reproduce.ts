import { searchErpProducts } from "./src/lib/erp.functions";

async function test() {
  console.log("--- TESTE AUDITORIA SPRINT 8.5.5 ---");
  const testCases = [
    { q: "Ipa", isAdminSearch: true, label: "Busca 'Ipa'" },
  ];

  for (const tc of testCases) {
    console.log("\nTESTANDO:", tc.label);
    try {
      // Nota: callErp vai falhar se não houver ENV, mas o validator do App roda antes
      const res = await searchErpProducts({ data: { q: tc.q, companyId: 1, limit: 50, isAdminSearch: tc.isAdminSearch } });
      console.log("STATUS:", res.status);
      if (res.error) console.log("ERRO:", JSON.stringify(res.error, null, 2));
    } catch (e) {
      console.log("FALHA NO VALIDATOR:", e.message);
    }
  }
}
test();
