import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrderFormStore } from "@/hooks/use-order-form";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground">Firebird ERP Bridge</h1>
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
          <a 
            href="/pedidos-venda" 
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para Pedidos
          </a>
          <button 
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:underline"
          >
            Resetar Formulário de Pedido
          </button>
        </div>
      )}
    </div>
  );
}