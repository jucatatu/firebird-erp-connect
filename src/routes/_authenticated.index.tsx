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
        <h2 className="text-xl font-bold mb-4 font-sans tracking-tight text-green-600">SPRINT 8.9.36 — Ciclo de Vida do Pedido e Bloqueio da Identidade</h2>
        
        {"Execute esta instrucao no projeto: SPRINT 8.9.36\n\n"}
        
        {"CREATE\n"}
        {"Cliente trava após seleção: PASS/FAIL\n"}
        {"Avança automaticamente ao passo 2: PASS/FAIL\n"}
        {"Passo 1 inacessível após seleção: PASS/FAIL\n"}
        {"Swipe bloqueado para passo 1: PASS/FAIL\n\n"}
        
        {"EDIT\n"}
        {"GET ERP executado: PASS/FAIL\n"}
        {"Status ERP revalidado: PASS/FAIL\n"}
        {"Cliente hidratado: PASS/FAIL\n"}
        {"Empresa hidratada: PASS/FAIL\n"}
        {"Itens hidratados: PASS/FAIL\n"}
        {"Equipamentos hidratados: PASS/FAIL\n"}
        {"Logística hidratada: PASS/FAIL\n"}
        {"Pagamento hidratado: PASS/FAIL\n"}
        {"Abre diretamente no passo 2: PASS/FAIL\n"}
        {"Pesquisa de cliente não exibida: PASS/FAIL\n"}
        {"Passo 1 inacessível: PASS/FAIL\n\n"}
        
        {"CANCELAMENTO\n"}
        {"Store completamente limpa: PASS/FAIL\n\n"}
        
        {"NODE ALTERADO: SIM/NÃO"}
      </div>

    </div>
  );
}
