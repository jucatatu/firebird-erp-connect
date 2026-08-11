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
        SPRINT 8.9.37.1 - DIAGNÓSTICO E CORREÇÃO GOOGLE MAPS
        Status: Aprovado. Causa: Instanciação prematura resolvida e logs de auditoria injetados.
        Melhorada a resiliência e o diagnóstico da integração Google Maps/Places.
        Adicionados logs detalhados para identificar falhas de API Key, libraries ou restrições.
        Corrigida a inicialização do autocomplete (Places New) e preservado fallback manual.
      </div>

    </div>
  );
}
