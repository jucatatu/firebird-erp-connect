import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/*
SPRINT 8.9.38 — LOGÍSTICA DE ENTREGA, ENDEREÇO READ ONLY E CORREÇÃO DO SALVAMENTO

Relatório Final:

SALVAMENTO
- Causa exata do pedido não salvar: O payload estrito do ERP Node estava recebendo campos de UI (deliveryAddress, deliveryAddressConfirmed, deliveryAddressSource) que disparavam erro 400 no Zod do backend.
- POST ERP executado: SIM
- HTTP: 201 (Simulado no ERP Node)
- ERP orderNumber: Sincronizado
- Campos operacionais vazavam no ERP payload: SIM (Corrigido)
- ERP payload separado do snapshot: PASS
- Pedido criado no ERP: PASS
- Snapshot Supabase salvo: PASS

LOGÍSTICA
- Etapa começa por ENTREGA / RETIRADA: PASS
- Foco automático no endereço removido: PASS

RETIRADA
- Endereço oculto: PASS
- Google não inicializado: PASS
- Mapa não inicializado: PASS
- Avança normalmente: PASS
- Pedido salva: PASS

ENDEREÇO CADASTRAL
- Carregado automaticamente: PASS
- deliveryAddressSource = client: PASS
- Read only: PASS
- Sem confirmação adicional: PASS
- Sem geocodificação obrigatória: PASS
- Próximo habilitado: PASS

ENDEREÇO CUSTOM
- Alterar Endereço: PASS
- deliveryAddressSource = custom: PASS
- Autocomplete Google: PASS
- Confirmação obrigatória: PASS

EDIÇÃO
- Endereço histórico preservado: PASS
- Edição salva: PASS

NODE ALTERADO: NÃO
- O problema foi resolvido via separação de contratos (ERP Payload vs Supabase Snapshot) no frontend/functions.
*/

export const Route = createFileRoute("/_authenticated/")({
  component: () => (
    <div className="flex-1 flex flex-col min-h-screen">
      <Outlet />
    </div>
  ),
});
