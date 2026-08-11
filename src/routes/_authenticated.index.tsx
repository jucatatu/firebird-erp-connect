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
        SPRINT 8.9.36.5 - CORRIGIR COBERTURA DE EQUIPAMENTOS NO MODO EDIÇÃO
        O problema era a falta de metadados logísticos (capacityLiters, role, assignedProductId) nos equipamentos carregados do ERP.
        A solução foi implementar a normalização automática dos equipamentos ao carregar o modo edição, utilizando o catálogo equipmentTypes e snapshots do Supabase como fonte auxiliar.
        A cobertura agora é recalculada imediatamente e libera a navegação.
      </div>
    </div>
  );
}
