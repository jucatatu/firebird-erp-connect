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
    navigate({ to: "/pedidos-venda", replace: true });
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
        <h2 className="text-xl font-bold mb-4 font-sans tracking-tight text-green-600">SPRINT 8.9.19 — CORREÇÃO DE REGRESSÕES NOVO PEDIDO CONCLUÍDA</h2>
        
        {"Foram implementadas melhorias críticas na precisão logística e flexibilidade comercial.\n\n"}

        {"==================================================\n"}
        {"1. EDIÇÃO DE PREÇO UNITÁRIO\n"}
        {"==================================================\n"}
        {"- Edição Manual: Operadores agora podem alterar o preço aplicado a cada item clicando no valor no card do produto.\n"}
        {"- Rastreabilidade: O sistema mantém o preço original do ERP e o preço aplicado, sinalizando visualmente itens com preço 'Manual'.\n"}
        {"- Recálculo em Tempo Real: Subtotais e totais do pedido são atualizados instantaneamente após a edição.\n"}
        {"- Preservação de Master: Edições afetam apenas o pedido atual, sem alterar tabelas de preço no Firebird.\n\n"}

        {"==================================================\n"}
        {"2. COBERTURA DE BARRIS POR PRODUTO\n"}
        {"==================================================\n"}
        {"- Alocação Estrita: A cobertura de litros agora é calculada individualmente para cada tipo de chopp, eliminando a falha de 'pool global'.\n"}
        {"- Sugestão Inteligente: O botão 'Sugerir' associa automaticamente cada barril ao seu respectivo produto draft.\n"}
        {"- Validação Robusta: O botão 'Continuar' agora exige que TODOS os produtos draft estejam cobertos por seus barris específicos.\n"}
        {"- UI Detalhada: O card de cobertura exibe quais barris estão alocados para cada chopp e sinaliza excessos por sabor.\n\n"}

        {"==================================================\n"}
        {"3. LOGÍSTICA E EQUIPAMENTOS\n"}
        {"==================================================\n"}
        {"- Preservação da Sprint 8.9.10: Mantida a otimização de vias de chopeira e minimização de equipamentos físicos.\n"}
        {"- Ciclo de Vida: Novo Pedido continua iniciando limpo, garantindo integridade dos dados.\n\n"}

        {"==================================================\n"}
        {"ENTREGA FINAL\n"}
        {"==================================================\n"}
        {"1. Zustand Store: Adicionado assignedProductId em OrderEquipment e updateItemPrice em OrderItem.\n"}
        {"2. ProductCard: Implementado modal de edição de preço inline.\n"}
        {"3. Lógica de Cobertura: Refatorada para ser baseada em productId, não mais em pools globais.\n"}
        {"4. Payload ERP: Preço unitário manual agora é enviado corretamente ao backend.\n"}
        {"5. Arquivos alterados:\n"}
        {"   - src/hooks/use-order-form.ts (Schema & State updates)\n"}
        {"   - src/routes/_authenticated.pedidos-venda.novo.tsx (UI & Logic)\n"}
        {"   - src/lib/erp-orders.functions.ts (Type consistency)\n"}
        {"   - src/routes/_authenticated.index.tsx (Logs)\n"}


      </div>
    </div>
  );
}
