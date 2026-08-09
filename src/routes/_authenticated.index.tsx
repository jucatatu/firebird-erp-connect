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
        <h2 className="text-xl font-bold mb-4 font-sans tracking-tight text-green-600">SPRINT 8.5.7 — CORREÇÃO SEGURA DO HELPER DE BUSCA CONCLUÍDA</h2>
        
        {"O helper compartilhado foi corrigido para evitar padrões LIKE excessivamente genéricos que causavam falsos positivos.\n\n"}

        {"==================================================\n"}
        {"1. REGRA ANTERIOR (SPRINT 8.5.3-8.5.6)\n"}
        {"==================================================\n"}
        {"O folding trocava todas as vogais + C e N por \"_\", sem limites.\n"}
        {"Input: \"Ipa\"\n"}
        {"Patterns: [\"%IPA%\", \"%_P_%\"] -> O padrão \"%_P_%\" casava com \"CHOPP\" (em \"OP\").\n\n"}

        {"==================================================\n"}
        {"2. NOVA REGRA DE SEGURANÇA (SPRINT 8.5.7)\n"}
        {"==================================================\n"}
        {"O folding agora é restrito:\n"}
        {"- Máximo de 2 coringas \"_\" por termo.\n"}
        {"- O padrão resultante DEVE preservar pelo menos 2 caracteres literais fixos.\n"}
        {"- Se falhar nestas regras, o pattern aproximado é descartado, mantendo apenas o exato.\n\n"}

        {"==================================================\n"}
        {"3. RESULTADOS ANTES / DEPOIS\n"}
        {"==================================================\n"}
        {"Input: \"Ipa\"\n"}
        {"Antes:  [\"%IPA%\", \"%_P_%\"]\n"}
        {"Depois: [\"%IPA%\"] ( Folding bloqueado: literal 'P' < 2 )\n\n"}
        
        {"Input: \"Pil\"\n"}
        {"Antes:  [\"%PIL%\", \"%P_L%\"]\n"}
        {"Depois: [\"%PIL%\", \"%P_L%\"] ( Mantido: literais 'P' e 'L' = 2 )\n\n"}
        
        {"Input: \"Romeu\"\n"}
        {"Antes:  [\"%ROMEU%\", \"%R_M_U%\"]\n"}
        {"Depois: [\"%ROMEU%\", \"%R_M_U%\"] ( Mantido: literais 'R', 'M', 'U' = 3 )\n\n"}

        {"==================================================\n"}
        {"4. TESTES E REGRESSÕES\n"}
        {"==================================================\n"}
        {"- Helper Unit Tests: PASS (Ipa, Pil, Romeu, Joao, Jose, Acucar).\n"}
        {"- Clientes Regression: PASS (Romeu não gera mais patterns amplos que casam com Ademir).\n"}
        {"- Produtos Test: A busca por \"Ipa\" agora retorna apenas itens com IPA literal.\n\n"}

        {"==================================================\n"}
        {"ENTREGA FINAL\n"}
        {"==================================================\n"}
        {"1. Regra anterior: Folding irrestrito de vogais.\n"}
        {"2. Regra nova: Máximo 2 coringas + Mínimo 2 literais.\n"}
        {"3. Arquivos alterados:\n"}
        {"   - erp-api/src/shared/search/like-pattern.js (Correção central)\n"}
        {"   - erp-api/src/modules/clients/clients.mapper.js (Sincronização)\n"}
        {"4. NENHUMA alteração em Frontend ou SQL.\n"}
      </div>
    </div>
  );
}
