import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/dashboard')({
  head: () => ({
    meta: [
      { title: "Diagnóstico de Idempotência — Sprint 7.1" },
      { name: "description", content: "Análise técnica do erro IDEMPOTENCY_NOT_READY na homologação real." }
    ]
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="border-b border-slate-200 pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">
            Sprint 7.1 — Investigar IDEMPOTENCY_NOT_READY
          </h1>
          <p className="text-slate-500 mt-2">
            Diagnóstico e procedimento recomendado para homologação no Windows Server.
          </p>
        </header>

        <div className="bg-amber-50 text-amber-800 p-6 rounded-xl border border-amber-200 flex items-start gap-4">
          <div className="mt-1 bg-amber-100 p-2 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-amber-900 mb-1">Resultado Real: HTTP 503</h2>
            <p className="font-mono text-sm mb-2 font-bold">code: IDEMPOTENCY_NOT_READY</p>
            <p className="text-sm opacity-90 leading-relaxed">
              O problema de HMAC foi resolvido e a requisição chega ao endpoint, mas o sistema bloqueia a operação por falta de persistência segura em ambiente de produção.
            </p>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">1</span>
              Variável de Ambiente Exata
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              O nome exato da variável no código é: <code className="bg-slate-100 px-1 rounded font-bold text-slate-900">IDEMPOTENCY_FILE_PATH</code>.
            </p>
            <p className="text-sm text-slate-600">
              Valor recomendado para Windows: <br/>
              <code className="bg-slate-800 text-slate-200 px-2 py-1 rounded text-xs block mt-2">C:\ERP-API-V2\data\idempotency.json</code>
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">2</span>
              Infraestrutura e Permissões
            </h3>
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-4">
              <li><strong>Pasta Prévia:</strong> Não é obrigatório criar a pasta <code className="text-xs italic">data</code> manualmente; o código executa <code className="text-xs">mkdir recursive: true</code> no boot.</li>
              <li><strong>Arquivo:</strong> Criado automaticamente se não existir (<code className="text-xs">ENOENT</code> é tratado no <code className="text-xs italic">load()</code>).</li>
              <li><strong>Permissões:</strong> O usuário do Windows que roda o Node precisa de permissão de <strong>Modify/Escrita</strong> no diretório pai.</li>
            </ul>
          </div>
        </section>

        <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Reinício Necessário</h3>
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <p className="text-sm text-blue-900 leading-relaxed font-semibold">
              SIM, é necessário reiniciar o processo Node (PM2 ou Windows Service).
            </p>
            <p className="text-xs text-blue-700 mt-2">
              A configuração do <code className="text-xs">.env</code> é lida apenas uma vez no boot pelo módulo <code className="text-xs italic">erp-api/src/config/env.js</code>. Alterações no arquivo com a API rodando não surtirão efeito imediato.
            </p>
          </div>
        </section>

        <section className="bg-slate-900 rounded-xl p-8 shadow-xl border border-slate-800 space-y-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Bloco de Configuração (.env)
            </h3>
            <p className="text-slate-400 text-sm italic">
              Adicione as linhas abaixo ao final do seu arquivo .env:
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
              <pre className="text-green-400 font-mono text-sm leading-relaxed">
# Persistência de Idempotência{"\n"}
IDEMPOTENCY_STORE=file{"\n"}
IDEMPOTENCY_FILE_PATH=C:\ERP-API-V2\data\idempotency.json{"\n"}
IDEMPOTENCY_TTL_HOURS=24
              </pre>
            </div>
          </div>
        </section>

        <footer className="text-center text-xs text-slate-400 pt-8 pb-12 border-t border-slate-200">
          Diagnóstico Concluído — ERP API v1.8.0 | Sprint 7.1
        </footer>
      </div>
    </div>
  );
}
