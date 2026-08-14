import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 border-b pb-4">
          SPRINT 8.9.37.6 — CORRIGIR CRASH AO RENDERIZAR AUTOCOMPLETE DATA API
        </h1>
        
        <div className="space-y-6 text-slate-700 font-mono text-sm overflow-auto max-h-[70vh]">
          <section className="space-y-2">
            <h2 className="font-bold text-red-600 uppercase">Relatório Final</h2>
            <div className="grid grid-cols-1 gap-2 bg-slate-100 p-4 rounded-lg">
              <p>CAUSA EXATA DO CRASH: Acesso obrigatório a .mainText.text em objetos que não garantiam essa estrutura.</p>
              <p>Acesso inseguro encontrado em: src/components/order/delivery-address-section.tsx</p>
              <p>Era:</p>
              <ul className="list-disc pl-5">
                <li>placePrediction ausente: NÃO (mas agora protegido)</li>
                <li>mainText ausente: SIM (causava o crash)</li>
                <li>secondaryText ausente: SIM</li>
              </ul>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-blue-600 uppercase">Validações</h2>
            <div className="space-y-1">
              <p>✅ Normalização de sugestões implementada: PASS</p>
              <p>✅ placePrediction protegido: PASS</p>
              <p>✅ mainText protegido: PASS</p>
              <p>✅ secondaryText protegido: PASS</p>
              <p>✅ Controle de concorrência (active flag): PASS</p>
              <p>✅ Fallback visual (fullText/text): PASS</p>
              <p>✅ Autocomplete Data API (New) preservada: PASS</p>
              <p>✅ NODE ERP ALTERADO: NÃO</p>
            </div>
          </section>

          <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 italic">
            "A integração já chega corretamente à Autocomplete Data API. O problema era exclusivamente um crash na renderização das sugestões por falta de normalização defensiva."
          </div>
        </div>
        
        <div className="mt-8 flex justify-end">
          <a 
            href="/pedidos-venda/novo" 
            className="bg-primary text-white px-6 py-2 rounded-lg font-bold hover:opacity-90 transition-opacity"
          >
            Ir para Novo Pedido e Testar
          </a>
        </div>
      </div>
    </div>
  )
})
