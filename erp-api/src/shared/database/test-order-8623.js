const firebird = require("./firebird-client");
const { logger } = require("../../config/logger");

async function testOrderDetail() {
  console.log("--- TESTE REAL: GET /api/v1/orders/8623 ---");
  try {
    const orderNumber = 8623;
    const sql = "SELECT ov.*, s.DESCRICAO AS STATUS_DESCRICAO FROM ORDENS_VENDA ov LEFT JOIN STATUS s ON s.ID_STATUS = ov.ID_STATUS WHERE ov.N_PEDIDO = ?";
    console.log("Executando query de cabeçalho...");
    const rows = await firebird.executeQuery(sql, [orderNumber]);
    const order = Array.isArray(rows) ? rows[0] : rows;
    if (!order) { console.error("❌ Pedido 8623 NÃO encontrado."); process.exit(1); }
    console.log("✅ Cabeçalho encontrado ID:", order.ID_ORDENS_VENDA);
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}
testOrderDetail();
