import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/*
SPRINT 8.9.39.3 — CORRIGIR TELA VAZIA DO EDIT SEM REINTRODUZIR O LOOP DE NAVEGAÇÃO

CAUSA
- step local iniciava como "client" na montagem.
- Zustand persistia isEditing e erpOrderNumber.
- O effect de hidratação via que o orderNumber no Zustand era o mesmo da URL e retornava cedo.
- setStepState("items") nunca era chamado.
- identityLocked impedia ver a etapa "client".
- Resultado: Tela branca/vazia no edit após refresh.

CORREÇÃO
- hydratedEditOrderNumber (local useState) agora rastreia hidratação por montagem.
- O effect ignora o estado persistido do Zustand e força um GET ERP autoritativo uma vez por abertura de rota.
- setStepState("items") é disparado atomicamente após o sucesso do GET.
- step foi removido das dependências para evitar loop de navegação (Items -> Delivery -> Items).
- isHydrating gate agora aguarda a sincronização local.

HEADER
- Corrigido fallback enganoso que mostrava "GRAAL" quando companyId era nulo.

LOGÍSTICA / EQUIPAMENTOS
- Normalização 8.9.39.1 de equipamentos mantida intacta.
- Recalculo de cobertura preservado.
*/

export const Route = createFileRoute("/_authenticated/")({
  component: () => (
    <div className="flex-1 flex flex-col min-h-screen">
      <Outlet />
    </div>
  ),
});
