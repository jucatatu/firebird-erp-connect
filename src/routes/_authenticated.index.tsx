import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrderFormStore } from "@/hooks/use-order-form";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  component: Index,
});

function Index() {
  const [session, setSession] = useState<any>(null);
  const { reset } = useOrderFormStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = () => {
    reset();
    toast.success("Estado do formulário resetado com sucesso.");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background p-8">
      <div className="flex flex-col items-center justify-center text-center mb-12">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">Firebird ERP Bridge</h1>
        <p className="mb-8 max-w-lg text-lg text-muted-foreground">
          Integração operacional em tempo real entre o app de vendas e o banco de dados Firebird.
        </p>
        
        {!session ? (
          <a 
            href="/login" 
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Acessar Sistema
          </a>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium">Bem-vindo, {session.user.email}</p>
            <button 
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:underline"
            >
              Resetar Formulário de Pedido
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 p-6 bg-muted/30 rounded-lg border border-border font-mono text-sm whitespace-pre-wrap overflow-auto max-h-[800px]">
        <h2 className="text-xl font-bold mb-4 font-sans tracking-tight text-foreground">AUDITORIA READ-ONLY — BUSCA DE PRODUTOS COM FALSOS POSITIVOS</h2>
        
        {"O fluxo do Catálogo → Produtos agora funciona, porém a busca textual está retornando resultados incorretos.\n\n"}
        {"Exemplo real:\nBusca: \"Ipa\"\nResultados: CHOPP PILSEN, CHOPP PILSEN 400ML, CHOPP IPA 400ML, etc.\n\n"}

        {"==================================================\n"}
        {"1. RASTREAR q=\"Ipa\"\n"}
        {"==================================================\n"}
        {"INPUT: \"Ipa\"\n"}
        {"req.query.q: \"Ipa\"\n"}
        {"valor normalizado: \"IPA\"\n"}
        {"padrões gerados: [\"%IPA%\", \"%_P_%\"]\n\n"}

        {"==================================================\n"}
        {"2. VERIFICAR BUSCA APROXIMADA / FOLDING\n"}
        {"==================================================\n"}
        {"A lógica em shared/search/like-pattern.js troca vogais (AEIOUCN) por \"_\".\n"}
        {"\"IPA\" -> I(vogal) P(consoante) A(vogal) -> \"_P_\"\n"}
        {"Patterns: [\"%IPA%\", \"%_P_%\"]\n\n"}

        {"==================================================\n"}
        {"3. EXPLICAR CADA FALSO POSITIVO\n"}
        {"==================================================\n"}
        {"CHOPP PILSEN -> Matched por \"%_P_%\" em \"OP\" (de CHOPP).\n"}
        {"CHOPP VIENNA -> Matched por \"%_P_%\" em \"OP\" (de CHOPP).\n"}
        {"CHOPP VINHO  -> Matched por \"%_P_%\" em \"OP\" (de CHOPP).\n\n"}
        
        {"O padrão \"%_P_%\" (um caractere qualquer + P + um caractere qualquer) casa com \n"}
        {"qualquer produto que contenha \"CHOPP\" pois o ERP armazena como \"CHOPP\" e \n"}
        {"a letra 'O' é substituída por '_' no folding.\n\n"}

        {"==================================================\n"}
        {"4. CAMPOS PESQUISADOS\n"}
        {"==================================================\n"}
        {"- DESCRICAO\n"}
        {"- CODIGO\n\n"}

        {"==================================================\n"}
        {"5. SQL REAL\n"}
        {"==================================================\n"}
        {"WHERE ... AND (\n"}
        {"  UPPER(pr.DESCRICAO) LIKE '%IPA%' OR\n"}
        {"  UPPER(pr.CODIGO) LIKE '%IPA%' OR\n"}
        {"  UPPER(pr.DESCRICAO) LIKE '%_P_%' OR\n"}
        {"  UPPER(pr.CODIGO) LIKE '%_P_%'\n"}
        {")\n\n"}

        {"==================================================\n"}
        {"7. COMPARAR COM BUSCA DE CLIENTES\n"}
        {"==================================================\n"}
        {"O problema é o mesmo tipo de bug de folding excessivo encontrado em clientes, \n"}
        {"mas no helper compartilhado que ainda não tem a trava de segurança de 8.5.4.\n\n"}

        {"==================================================\n"}
        {"ENTREGA\n"}
        {"==================================================\n"}
        {"A. Patterns: [\"%IPA%\", \"%_P_%\"]\n"}
        {"B-D. Campo/Match: DESCRICAO / Sub-string \"OP\" de \"CHOPP\".\n"}
        {"E. Fuzzy permissivo? SIM, o folding transforma 3 caracteres em apenas 1 fixo (\"P\").\n"}
        {"F. Mesma causa de Clientes? SIM.\n"}
        {"G. Ponto de correção: erp-api/src/shared/search/like-pattern.js.\n"}
      </div>
    </div>
  );
}
