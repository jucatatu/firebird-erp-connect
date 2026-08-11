import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);

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

  return (
    <div className="min-h-screen bg-background">
      <Outlet />
      
      <div className="hidden">
        SPRINT 8.9.36.6 - RECALCULAR COBERTURA AUTOMATICAMENTE
        A cobertura agora e tratada como estado derivado reativo. 
        A normalizacao de equipamentos ocorre automaticamente sempre que o catalogo ou os itens mudam,
        garantindo que assignedProductId seja preenchido (especialmente no caso de um unico chopp) 
        sem necessidade de clique manual.
      </div>
    </div>
  );
}
