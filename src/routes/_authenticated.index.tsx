import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/')({
  head: () => ({
    meta: [
      { title: "Auditoria Direcionada — HMAC 401" },
      { name: "description", content: "Relatório de auditoria de autenticação HMAC para ERP API." }
    ]
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="border-b border-slate-200 pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Auditoria Direcionada — HMAC 401
          </h1>
          <p className="text-slate-500 mt-2">
            Análise técnica da falha de autenticação na homologação Sprint 7.1
          </p>
        </header>

        <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-100 flex items-start gap-3">
            <div className="mt-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <h2 className="font-semibold text-red-800">Erro Detectado: 401 Unauthorized</h2>
              <p className="text-sm opacity-90">
                A API rejeitou a requisição HMAC. O script <code className="text-xs bg-red-100 px-1 rounded">test-order-win.js</code> e o middleware <code className="text-xs bg-red-100 px-1 rounded">auth.middleware.js</code> possuem divergências sutis no cálculo do Body Hash e na String Canônica.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Headers Obrigatórios</h3>
              <ul className="space-y-2 text-sm border-l-2 border-slate-200 pl-4">
                <li><code className="bg-slate-100 px-1 rounded text-slate-700 font-mono">x-api-key</code>: Identificação do cliente.</li>
                <li><code className="bg-slate-100 px-1 rounded text-slate-700 font-mono">x-timestamp</code>: Unix time em milissegundos.</li>
                <li><code className="bg-slate-100 px-1 rounded text-slate-700 font-mono">x-nonce</code>: String aleatória (8-128 chars).</li>
                <li><code className="bg-slate-100 px-1 rounded text-slate-700 font-mono">x-signature</code>: Assinatura HMAC SHA256 (hex).</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Configuração de Ambiente</h3>
              <ul className="space-y-2 text-sm border-l-2 border-slate-200 pl-4">
                <li><code className="bg-slate-100 px-1 rounded font-mono text-slate-700">API_KEY</code>: <span className="italic text-slate-400">Mascarado (Vínculo comercial)</span></li>
                <li><code className="bg-slate-100 px-1 rounded font-mono text-slate-700">HMAC_SECRET</code>: <span className="italic text-slate-400">Mascarado (Segredo da chave)</span></li>
                <li><code className="bg-slate-100 px-1 rounded font-mono text-green-700">PORT</code>: Padrão 3052 (Configurado no Node)</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">Divergências Encontradas (Causa Raiz)</h3>
            
            <div className="bg-slate-50 p-4 rounded-lg space-y-3 border border-slate-100">
              <h4 className="font-semibold text-slate-700">1. Cálculo do Body Hash</h4>
              <p className="text-sm text-slate-600">
                O script <code className="text-xs bg-slate-200 px-1 rounded">test-order-win.js</code> usa os <strong>bytes brutos</strong> do arquivo <code className="text-xs">payload.json</code>.
                Contudo, o middleware usa <code className="text-xs">JSON.stringify(req.body)</code> após o processamento do <code className="text-xs">express.json()</code>.
              </p>
              <p className="text-xs text-slate-400 italic">
                * Se o JSON no arquivo tiver espaços ou quebras de linha diferentes da serialização padrão do Node, as hashes divergirão.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg space-y-3 border border-slate-100">
              <h4 className="font-semibold text-slate-700">2. String Canônica (Case-Sensitivity)</h4>
              <p className="text-sm text-slate-600">
                O middleware força <code className="text-xs bg-slate-200 px-1 rounded">method.toUpperCase()</code> na assinatura. O script Windows define a variável como <code className="text-xs font-mono">"POST"</code> manualmente. Embora coincida para POST, deve-se garantir consistência total.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-900 rounded-lg shadow-inner">
            <h3 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Relatório de Verificação Final
            </h3>
            <pre className="text-xs overflow-auto p-4 bg-slate-800 text-slate-300 rounded border border-slate-700 leading-relaxed font-mono">
{`AUDITORIA DIRECIONADA — HMAC 401 NA HOMOLOGAÇÃO

[HEADERS]
1. Identificação: Header 'x-api-key' (confirmado).
2. Obrigatórios: x-api-key, x-timestamp, x-nonce, x-signature.
3. Timestamp: Milissegundos (Date.now()).

[STRING CANÔNICA]
Estrutura: METHOD + "\\n" + PATH + "\\n" + TIMESTAMP + "\\n" + NONCE + "\\n" + BODYHASH
Nota: O PATH utilizado deve ser req.originalUrl (inclui querystring).

[BODYHASH]
Calculado via: crypto.createHash("sha256").update(JSON.stringify(req.body)).digest("hex")
Atenção: O script Windows deve carregar o JSON e re-serializar via JSON.stringify(JSON.parse(raw)) 
para garantir paridade de caracteres com o Express.

[AUTENTICAÇÃO]
- Variáveis: API_KEY e HMAC_SECRET (confirmado).
- Motivo 401: Falha em 'invalid_signature' no middleware devido à diferença na serialização do body hash.
- Ambiente: O servidor em C:\\ERP-API-V2 deve ter API_KEY e HMAC_SECRET no .env com valores idênticos aos passados ao script.`}
            </pre>
          </div>
        </section>

        <footer className="text-center text-xs text-slate-400 pt-8 pb-12">
          Auditoria concluída em {new Date().toLocaleDateString('pt-BR')} | ERP API v1.8.0
        </footer>
      </div>
    </div>
  );
}
