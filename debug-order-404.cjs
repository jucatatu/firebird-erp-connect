
const firebird = require("./erp-api/src/shared/database/firebird-client");
const repository = require("./erp-api/src/modules/orders/orders.repository");

async function debug() {
  console.log("[ORDER DETAIL DEBUG] Iniciando auditoria para N_PEDIDO 8623");
  
  try {
    // 1. Auditoria do formato de executeQuery
    console.log("1. AUDITANDO executeQuery(SELECT 1)...");
    const result1 = await firebird.executeQuery("SELECT 1 AS VAL FROM RDB$DATABASE", []);
    console.log("- Tipo do retorno:", typeof result1);
    console.log("- Array.isArray:", Array.isArray(result1));
    console.log("- Resultado:", JSON.stringify(result1));
    if (result1 && typeof result1 === 'object') {
       console.log("- Chaves:", Object.keys(result1));
    }

    // 2. Teste SQL Mínimo
    console.log("\n2. EXECUTANDO SELECT MÍNIMO PARA N_PEDIDO 8623...");
    const sqlMin = "SELECT ID_ORDENS_VENDA, N_PEDIDO FROM ORDENS_VENDA WHERE N_PEDIDO = ?";
    const resultMin = await firebird.executeQuery(sqlMin, [8623]);
    console.log("- Resultado Mínimo:", JSON.stringify(resultMin));
    
    // 3. Simular fetchOrderByNumber original
    console.log("\n3. SIMULANDO fetchOrderByNumber(8623)...");
    const order = await repository.fetchOrderByNumber(null, 8623);
    console.log("- Retorno do repository:", order ? "ENCONTRADO" : "NÃO ENCONTRADO");
    if (order) {
        console.log("- ID_ORDENS_VENDA:", order.ID_ORDENS_VENDA);
    }

  } catch (err) {
    console.error("ERRO DURANTE DEBUG:", err);
  }
}

debug();
