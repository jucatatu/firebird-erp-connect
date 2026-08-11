
import { firebird } from "./firebird-client.js";

async function testOrderDetail() {
  console.log("--- TESTE REAL: GET /api/v1/orders/8623 ---");
  try {
    const orderNumber = 8623;
    
    // Simular o que o repository faz
    const sql = `
      SELECT
          ov.*,
          s.DESCRICAO AS STATUS_DESCRICAO
      FROM ORDENS_VENDA ov
      LEFT JOIN STATUS s
          ON s.ID_STATUS = ov.ID_STATUS
      WHERE ov.N_PEDIDO = ?
    `;
    
    console.log("Executando query de cabeçalho...");
    const rows = await firebird.executeQuery(sql, [orderNumber]);
    const order = Array.isArray(rows) ? rows[0] : rows;
    
    if (!order) {
      console.error("❌ Pedido 8623 NÃO encontrado no Firebird.");
      process.exit(1);
    }
    
    console.log("✅ Cabeçalho encontrado:", {
      ID_ORDENS_VENDA: order.ID_ORDENS_VENDA,
      N_PEDIDO: order.N_PEDIDO,
      STATUS: order.STATUS_DESCRICAO
    });
    
    const orderId = order.ID_ORDENS_VENDA;
    
    // Testar itens
    const sqlItems = `
      SELECT
          iov.ID_PRODUTO,
          pr.DESCRICAO,
          iov.QTDE_PEDIDA,
          iov.PRECO_UNIT
      FROM ITENS_ORDENS_VENDA iov
      LEFT JOIN PRODUTOS pr
          ON iov.ID_PRODUTO = pr.ID_PRODUTOS
      WHERE iov.ID_ORDENS_VENDA = ?
        AND (iov.DELETED IS NULL OR iov.DELETED = 0)
    `;
    console.log("Executando query de itens...");
    const items = await firebird.executeQuery(sqlItems, [orderId]);
    console.log(`✅ Itens encontrados: ${items.length}`);
    
    // Testar equipamentos
    const sqlEquip = `
      SELECT
          eov.ID_TIPO_EQUIPAMENTO,
          te.DESCRICAO,
          eov.QTDE
      FROM EQUIP_ORDENS_VENDA eov
      LEFT JOIN TIPO_EQUIPAMENTO te
          ON eov.ID_TIPO_EQUIPAMENTO = te.ID_TIPO_EQUIPAMENTO
      WHERE eov.ID_ORDENS_VENDA = ?
        AND (eov.DELETED IS NULL OR eov.DELETED = 0)
    `;
    console.log("Executando query de equipamentos...");
    const equips = await firebird.executeQuery(sqlEquip, [orderId]);
    console.log(`✅ Equipamentos encontrados: ${equips.length}`);
    
    console.log("--- TESTE CONCLUÍDO COM SUCESSO ---");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro no teste:", error);
    process.exit(1);
  }
}

testOrderDetail();
