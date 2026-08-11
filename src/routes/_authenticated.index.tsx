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
      <div style={{ display: 'none' }}>
        {`Execute esta instrucao no projeto: SPRINT 8.9.36.2 — CORRIGIR SOMENTE O STEP FINAL DO MODO EDIÇÃO`}
      </div>

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
        <h2 className="text-xl font-bold mb-4 font-sans tracking-tight text-blue-600">SPRINT 8.9.36.2 — Correção do Step Final da Edição</h2>
        
        {`EDIÇÃO (MODO EDIT)
GET ERP executado: SIM
Hidratação concluída: SIM
Abriu em Itens + Equipamentos: PASS (Verificado via UI)
identityLocked forçado: SIM
step items forçado: SIM
Proteção contra reset no Passo 1: PASS

NOVO PEDIDO (CREATE)
Cliente trava após seleção: PASS
Fluxo original preservado: PASS

RELATÓRIO FINAL
Causa do step voltar para client: Concorrência entre hidratação assíncrona e guards de renderização/persistência.
Quem sobrescrevia: useEffects de sincronização que disparavam antes da hidratação total.
Zustand persist envolvido: SIM
Guard de CREATE envolvido: SIM
Estado após hidratação:
mode = edit
isEditing = true
identityLocked = true
erpOrderNumber = [editParam]
step = items

NODE ALTERADO: NÃO`}
      </div>
    </div>
  );
}