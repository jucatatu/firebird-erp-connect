import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrderFormStore } from "@/hooks/use-order-form";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const { reset } = useOrderFormStore();

  useEffect(() => {
    // Redireciona para pedidos-venda por padrão conforme a nova UX (Sprint 8.9.19)
    navigate({ to: "/pedidos-venda", search: { status: "all" } as any, replace: true });
  }, [navigate]);

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
        <h2 className="text-xl font-bold mb-4 font-sans tracking-tight text-green-600">SPRINT 8.9.28 — STATUS INICIAL 27 + CORREÇÃO DE DATA CIVIL + EDIÇÃO CONTROLADA</h2>
        
        {"Todo pedido novo criado pelo APP deve ser salvo no ERP inicialmente com ID_STATUS = 27 (EM ANALISE).\n\n"}

        {"==================================================\n"}
        {"1. FLUXO DE STATUS GARANTIDO\n"}
        {"==================================================\n"}
        {"- Garantia de Status 27: Após a chamada da procedure SP_CAD_ORDEM_VENDA_COMPLETO, o Node executa um UPDATE explícito para forçar o status 27.\n"}
        {"- Transacionalidade: A criação e o ajuste de status ocorrem dentro da mesma transação Firebird, garantindo que o pedido nunca nasça 'Liberado' por engano.\n"}
        {"- Backend First: A regra reside no Node, tornando o sistema imune a falhas de rede ou manipulações no frontend.\n\n"}

        {"==================================================\n"}
        {"2. CORREÇÃO DE DATA CIVIL (ANTI-TIMEZONE)\n"}
        {"==================================================\n"}
        {"- Problema Resolvido: Pedidos selecionados para o dia X estavam chegando no Firebird como dia X-1 às 21:00 devido a conversões automáticas para UTC.\n"}
        {"- toDateCivil: Nova lógica no mapper do Node que interpreta strings 'YYYY-MM-DD' como meio-dia local (12:00:00), neutralizando desvios de fuso horário do servidor.\n"}
        {"- Integridade: Data Prevista de Entrega e Recolhimento agora gravam exatamente o dia escolhido na UI.\n\n"}

        {"==================================================\n"}
        {"3. EDIÇÃO CONTROLADA POR STATUS\n"}
        {"==================================================\n"}
        {"- Whitelist Oficial: EDITABLE_STATUS_IDS = [1, 20, 24, 27].\n"}
        {"- Bloqueio de Faturamento: Pedidos com status 3 (FATURADO) ou outros fora da lista têm o botão 'Editar' desabilitado automaticamente.\n"}
        {"- Sincronização: Ambas as camadas (Frontend e Backend) utilizam a mesma regra de negócio centralizada.\n\n"}

        {"==================================================\n"}
        {"ARQUIVOS ALTERADOS\n"}
        {"==================================================\n"}
        {"- erp-api/src/modules/orders/orders.service.js (Orquestração do Status 27)\n"}
        {"- erp-api/src/modules/orders/orders.repository.js (SQL de Update de Status)\n"}
        {"- erp-api/src/modules/orders/orders.mapper.js (Lógica toDateCivil)\n"}
        {"- erp-api/src/modules/orders/orders.validator.js (Zod para Datas YYYY-MM-DD)\n"}
        {"- src/lib/erp-orders.functions.ts (Regras de UI canEdit)\n"}
        {"- src/routes/_authenticated.index.tsx (Logs)\n"}
      </div>

    </div>
  );
}
