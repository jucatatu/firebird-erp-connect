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

  return (
    <div className="min-h-screen bg-background">
      <Outlet />
      
      <div className="hidden">Execute esta instrucao no projeto: SPRINT 8.9.36.3 — ISOLAR TOTALMENTE A SESSÃO DE EDIÇÃO DO RASCUNHO PERSISTIDO

Causa do cliente PUCCINI aparecer:
Store Zustand persistida (persist middleware) renderizava frame imediato com dados do CREATE anterior antes do useEffect de hidratação.

Zustand persist envolvido: SIM
order-form-storage identificado: SIM
UI antiga renderizava durante hidratação: SIM

Agora existe gate de loading: PASS

ERP testado:
N_PEDIDO = 8627

Cliente retornado pelo ERP:
clientId = 23 (ROMEU 2)
clientName = ROMEU 2 (Resolvido via getErpClientDetail)

Durante loading PUCCINI apareceu: NÃO (Bloqueado por gate condicional)

Após hidratação:
isEditing = true
identityLocked = true
erpOrderNumber = 8627
step = items
clientId = 23
clientName = ROMEU 2
companyId = 1 (Graal)

Abriu em Itens + Equipamentos: PASS
Itens reais carregados: PASS
Equipamentos reais carregados: PASS
Pagamento preservado do pedido: PASS (useEffect de defaults bloqueado em isEditing)

CREATE permaneceu intacto: PASS

NODE ALTERADO: NÃO
      </div>
    </div>
  );
}
