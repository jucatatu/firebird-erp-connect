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
        SPRINT 8.9.37 - ENDEREÇO DE ENTREGA POR PEDIDO
        Implementação concluída com Google Maps (Places New API). 
        O endereço de entrega agora é um snapshot do pedido, obrigatório para logística ENTREGA.
        A confirmação é exigida no Wizard e o mapa operacional utiliza as coordenadas do pedido.
      </div>

    </div>
  );
}
