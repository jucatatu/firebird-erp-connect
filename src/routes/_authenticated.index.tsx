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
        <h2 className="text-xl font-bold mb-4 font-sans tracking-tight text-green-600">SPRINT 8.7.3 — CORRIGIR VAZAMENTO DE ESTADO CONCLUÍDA</h2>
        
        {"Foi implementada uma limpeza rigorosa de estado entre fluxos de pedidos.\n\n"}

        {"==================================================\n"}
        {"1. CAUSA RAIZ IDENTIFICADA\n"}
        {"==================================================\n"}
        {"- Causa do 11L: O botão '+' usava Math.max(0, val) sem validar o step, e o localQty inicializava com o valor persistido do carrinho anterior se houvesse coincidência de índice.\n"}
        {"- Adicionado automático: O Zustand persistia 'items' e 'equipments' no localStorage sem limpá-los corretamente após o sucesso do pedido.\n"}
        {"- Reset inadequado: A função reset() não limpava campos auxiliares de entrega e notas, e não era disparada ao trocar de cliente.\n\n"}

        {"==================================================\n"}
        {"2. MELHORIAS IMPLEMENTADAS\n"}
        {"==================================================\n"}
        {"- Reset Transacional: resetItemsAndClient() agora limpa items, equipments, notes, delivery dates e gera nova Idempotency-Key.\n"}
        {"- Segurança de Cliente: Trocar de cliente com carrinho ativo agora solicita confirmação e limpa o estado.\n"}
        {"- Lógica de Incremento: O handleQtyChange agora força o arredondamento para o step (ex: 10L -> 20L) impedindo valores quebrados como 11L.\n"}
        {"- Isolamento de Card: O ProductCard garante que localQty retorne ao default do catálogo se o item não estiver no carrinho.\n\n"}

        {"==================================================\n"}
        {"3. COMPORTAMENTO APÓS PEDIDO\n"}
        {"==================================================\n"}
        {"- Sucesso: O formulário é totalmente resetado e redirecionado para a listagem.\n"}
        {"- Reload: Se for o mesmo pedido (mesma sessão), o estado é preservado via localStorage.\n"}
        {"- Novo Início: Se o pedido anterior foi finalizado, a tela de Novo Pedido força a limpeza total.\n\n"}

        {"==================================================\n"}
        {"ENTREGA FINAL\n"}
        {"==================================================\n"}
        {"1. Idempotency-Key: Renovada a cada novo pedido.\n"}
        {"2. Equipamentos: Sempre iniciam vazios até ação explícita ou adição de chope.\n"}
        {"3. Cobertura: Bloqueada se não houver itens no carrinho.\n"}
        {"4. Arquivos alterados:\n"}
        {"   - src/hooks/use-order-form.ts (Reset total)\n"}
        {"   - src/routes/_authenticated.pedidos-venda.novo.tsx (UX & Lógica de Qty)\n"}
        {"   - src/routes/_authenticated.index.tsx (Logs)\n"}

      </div>
    </div>
  );
}
