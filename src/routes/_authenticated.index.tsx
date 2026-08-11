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
      
      <div className="hidden">Execute esta instrucao no projeto: SPRINT 8.9.36.4 — CORRIGIR ORDEM DOS HOOKS APÓS GATE DE HIDRATAÇÃO

NÃO ALTERAR NODE.
NÃO ALTERAR API.
NÃO ALTERAR O FLUXO CREATE.
NÃO ALTERAR AS REGRAS DE SESSÃO/IDENTIDADE.
NÃO REMOVER O GATE DE HIDRATAÇÃO.

O backend agora está comprovadamente funcionando.

Teste real:

GET /api/v1/orders/8627
→ HTTP 200

GET /api/v1/clients/1464
→ HTTP 200

Portanto o problema atual é exclusivamente frontend.

==================================================
ERRO REAL
==================================================

Na rota:

/pedidos-venda/novo?edit=8627

após terminar o loading ocorre:

Error: Rendered more hooks than during the previous render.

Stack:

Object.useRef
Tt
_authenticated.pedidos-venda.novo...

A tela fica em branco.

Isso indica violação da Rules of Hooks.

Muito provavelmente o Gate de Hidratação introduzido na Sprint 8.9.36.3
está retornando o componente ANTES que todos os hooks sejam executados.

Exemplo de padrão ERRADO:

const store = useOrderFormStore(...)

if (editHydrationStatus === "loading") {
  return <Loading />
}

const swipeHandlers = useSwipeable(...)
const ref = useRef(...)
const query = useQuery(...)

No primeiro render os hooks abaixo do return NÃO executam.

Quando loading termina, eles passam a executar.

React então detecta quantidade diferente de hooks entre renders e dispara:

Rendered more hooks than during the previous render.

==================================================
1. REGRA OBRIGATÓRIA
==================================================

TODOS os hooks do componente devem ser executados SEMPRE,
na mesma ordem, em TODOS os renders.

Portanto:

- useState
- useEffect
- useMemo
- useCallback
- useRef
- useSwipeable
- hooks Zustand
- hooks React Query
- qualquer hook customizado

devem estar declarados ANTES de qualquer return condicional.

==================================================
2. AUDITAR O COMPONENTE COMPLETO
==================================================

Arquivo principal:

src/routes/_authenticated.pedidos-venda.novo.tsx

Pesquisar TODO o componente por:

return

e verificar se existe qualquer retorno antecipado ANTES de:

useRef
useSwipeable
useEffect
useMemo
useCallback
useQuery
useMutation
hooks customizados

Especial atenção ao Gate implementado na Sprint 8.9.36.3:

hydrationLoading
editHydrationStatus
isHydratingEdit
loading edit

Não corrigir apenas o primeiro hook encontrado.

Auditar TODOS.

==================================================
3. ESTRUTURA CORRETA
==================================================

A estrutura deve ficar conceitualmente assim:

function NewOrderPage() {

  // 1. TODOS OS HOOKS PRIMEIRO

  const ...
  const ...
  const ref = useRef(...)
  const swipeHandlers = useSwipeable(...)
  const ...
  
  useEffect(...)
  useEffect(...)

  // nenhum hook depois daqui

  // 2. SOMENTE DEPOIS OS RETURNS CONDICIONAIS

  if (editHydrationStatus === "loading") {
    return <EditLoading />
  }

  if (editHydrationStatus === "error") {
    return <EditError />
  }

  // 3. RENDER NORMAL

  return <Wizard ... />
}

==================================================
4. ALTERNATIVA PREFERÍVEL
==================================================

Se o componente estiver muito grande, separar o Gate do Wizard.

Exemplo:

function NewOrderRoute() {
  // hooks necessários para hidratação

  if (loading) {
    return <EditLoading />
  }

  if (error) {
    return <EditError />
  }

  return <OrderWizard />
}

function OrderWizard() {
  // hooks exclusivos do wizard
  const ref = useRef(...)
  const swipe = useSwipeable(...)
  ...
}

Essa arquitetura também é válida porque cada componente mantém
sua própria ordem fixa de hooks.

Escolher a solução com menor risco de regressão.

==================================================
5. NÃO REMOVER O GATE
==================================================

O Gate da Sprint 8.9.36.3 resolveu um problema real:

um rascunho CREATE da PUCCINI aparecia durante a abertura da edição do ROMEU 2.

Portanto NÃO voltar ao comportamento anterior.

Durante:

?edit=8627

deve continuar aparecendo somente:

"Carregando pedido ERP 8627..."

até a hidratação terminar.

O que precisa mudar é apenas a organização dos hooks.

==================================================
6. PRESERVAR O ISOLAMENTO
==================================================

Após corrigir os hooks:

abrir ERP 8627.

Durante loading:

- não mostrar PUCCINI;
- não mostrar dados persistidos antigos;
- mostrar somente loading.

Depois da hidratação:

- cliente: ROMEU 2;
- empresa: GRAAL;
- identityLocked = true;
- isEditing = true;
- erpOrderNumber = 8627;
- step = items.

Primeira tela real:

ITENS + EQUIPAMENTOS.

==================================================
7. TESTE OBRIGATÓRIO CREATE
==================================================

Depois da correção testar também Novo Pedido.

Resultado esperado:

Novo Pedido
→ Empresa
→ Cliente
→ cliente selecionado
→ identidade bloqueada
→ Itens + Equipamentos

Sem:

Rendered more hooks than during the previous render.

==================================================
8. TESTE OBRIGATÓRIO EDIT
==================================================

Executar manualmente:

Pedidos
→ ERP 8627
→ Editar pedido

Esperado:

GET /orders/8627 → 200
GET /clients/1464 → 200
loading aparece
loading termina
nenhuma tela branca
nenhum Runtime Error
abre Itens + Equipamentos

Confirmar ainda:

cliente = ROMEU 2
empresa = Graal
itens existentes carregados
equipamentos carregados

==================================================
9. NÃO ALTERAR O BACKEND
==================================================

O backend já comprovou:

GET /api/v1/orders/8627 → 200
GET /api/v1/clients/1464 → 200

Portanto:

NODE ALTERADO: NÃO

Não tocar em:

orders.repository.js
orders.service.js
orders.controller.js

nesta sprint.

==================================================
RELATÓRIO FINAL
==================================================

SPRINT 8.9.36.4

Causa exata do erro de Hooks:
________________________________

Return condicional antes de hooks encontrado: SIM/NÃO

Hook(s) que estavam condicionais:
________________________________

Gate de hidratação preservado: PASS/FAIL

CREATE:
Sem erro de hooks: PASS/FAIL
Fluxo anterior preservado: PASS/FAIL

EDIT ERP 8627:
GET pedido 200: PASS/FAIL
GET cliente 200: PASS/FAIL
Loading exibido: PASS/FAIL
Tela branca eliminada: PASS/FAIL
Romeu 2 carregado: PASS/FAIL
Abriu em Itens + Equipamentos: PASS/FAIL
Itens carregados: PASS/FAIL
Equipamentos carregados: PASS/FAIL

NODE ALTERADO: NÃO</div>
    </div>
  );
}
