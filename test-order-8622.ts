
import { getErpOrderDetailDiagnostic } from './src/lib/erp-diagnostic.functions';

async function test() {
  console.log("--- INICIANDO TESTE ERP 8622 ---");
  try {
    const result = await getErpOrderDetailDiagnostic({ data: 8622 });
    console.log("RESULTADO REAL DO ERP 8622:");
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("ERRO NO TESTE:", e);
  }
}

test();
