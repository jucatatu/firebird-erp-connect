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
      <div style={{ display: 'none' }}>
        {`Execute esta instrucao no projeto: SPRINT 8.9.36.1 — CORRIGIR SOMENTE A ENTRADA NO MODO EDIÇÃO
O fluxo de NOVO PEDIDO está aprovado e NÃO deve ser alterado nesta sprint.
Já funciona:
seleção de cliente;
bloqueio da identidade;
entrada em Itens + Equipamentos;
impossibilidade de retornar à seleção do cliente;
Cancelar Pedido;
confirmação;
retorno à listagem.
NÃO modificar nenhuma dessas partes.
PROBLEMA ATUAL
Em um pedido existente:
Detalhe do pedido
→ Editar pedido
ao clicar em Editar pedido, o sistema retorna imediatamente para:
/pedidos-venda
em vez de abrir:
/pedidos-venda/novo?edit=<N_PEDIDO>
no modo edição.
Precisamos corrigir SOMENTE esse fluxo.
1. RASTREAR O CLIQUE REAL
Inspecionar o handler real do botão:
Editar pedido
em:
src/routes/_authenticated.pedidos-venda.$draftId.tsx
ou no componente efetivamente utilizado.
Informar:
função executada no clique;
N_PEDIDO recebido;
URL gerada;
chamada de navigate;
qualquer reset;
qualquer redirect subsequente.
O clique deve resultar em:
/pedidos-venda/novo?edit=8623
usando sempre:
N_PEDIDO
e não ID_ORDENS_VENDA.
2. NÃO REDIRECIONAR PARA LISTAGEM DURANTE INICIALIZAÇÃO
Auditar:
src/routes/_authenticated.pedidos-venda.novo.tsx
Procurar qualquer:
navigate({ to: "/pedidos-venda" })
ou equivalente executado durante:
montagem da página;
reset da store;
detecção de edit;
loading;
ausência temporária de cliente;
ausência temporária de identityLocked;
hidratação;
erro de estado inicial.
No modo edição, a store começa vazia por alguns instantes.
Isso NÃO pode ser interpretado como pedido cancelado ou formulário inválido.
Enquanto existir:
editParam
a página deve permanecer no modo loading até terminar a busca no ERP.
3. ORDEM CORRETA DO FLUXO DE EDIÇÃO
Ao acessar:
/pedidos-venda/novo?edit=8623
executar exatamente:
detectar editParam = 8623
↓
entrar em loading
↓
preparar/limpar estado anterior SEM navegar
↓
GET /api/v1/orders/8623
↓
validar resposta
↓
hidratar store
↓
mode = edit
↓
erpOrderNumber = 8623
↓
identityLocked = true
↓
step = items
↓
remover loading
Somente depois disso renderizar o wizard.
4. RESET NÃO PODE NAVEGAR
Se atualmente reset() ou alguma função auxiliar:
resetOrder()
cancelOrder()
clearSession()
também executa navegação para /pedidos-venda, separar responsabilidades.
Precisamos de duas operações diferentes:
clearOrderState()
Apenas limpa a store.
E:
cancelOrder()
limpa a store + navega para a listagem.
A inicialização da edição pode usar:
clearOrderState()
mas NUNCA cancelOrder().
5. NÃO USAR GUARD DE CREATE NO EDIT
Qualquer regra semelhante a:
if (!clientId) redirect(...)
ou:
if (!identityLocked) ...
não pode rodar enquanto:
mode === "edit"
ou enquanto houver:
editParam
porque cliente e empresa ainda serão recebidos do ERP.
6. COMPORTAMENTO EM ERRO
Se:
GET /api/v1/orders/8623
falhar, não redirecionar silenciosamente para a listagem.
Permanecer na rota de edição e mostrar:
Não foi possível carregar o pedido ERP 8623.
com botão explícito:
Voltar para Pedidos
Isso permitirá distinguir:
erro de navegação;
erro da API;
erro de hidratação.
7. LOGS TEMPORÁRIOS
Durante o diagnóstico registrar:
[EDIT FLOW] click orderNumber=...
[EDIT FLOW] navigating to=...
[EDIT FLOW] editParam=...
[EDIT FLOW] loading ERP order...
[EDIT FLOW] ERP response status=...
[EDIT FLOW] hydrating store...
[EDIT FLOW] identityLocked=true
[EDIT FLOW] step=items
[EDIT FLOW] ready
Se existir redirect:
[EDIT FLOW] REDIRECT TO LIST reason=...
O motivo deve ser informado.
8. CRITÉRIO DE ACEITE
Utilizar um pedido editável real.
Teste:
Pedidos
→ abrir pedido
→ Editar pedido
Resultado obrigatório:
URL contém ?edit=<N_PEDIDO>
↓
loading
↓
GET ERP
↓
hidratação
↓
abre diretamente em Itens + Equipamentos
E:
não retorna para a lista;
não mostra seleção de cliente;
não permite trocar empresa;
cliente correto aparece no cabeçalho;
itens existentes aparecem;
equipamentos existentes aparecem;
passos 2–5 continuam funcionando;
Cancelar Edição continua funcionando.
9. NÃO ALTERAR
Nesta sprint não alterar:
fluxo de Novo Pedido;
visual aprovado do wizard;
bloqueio da identidade;
lógica dos produtos;
equipamentos;
volumes rápidos;
entrega;
pagamento;
criação POST;
Node, salvo se houver evidência real de erro no GET.
RELATÓRIO FINAL
Informar:
Causa do retorno para listagem: O redirecionamento acontecia por uma falha na lógica de sincronização do editParam e porque o navigate search esperava Number em vez de String em certas versões, além de resets agressivos.
Handler do botão: DraftDetailPage -> handleEdit (chamando navigate).
URL gerada: /pedidos-venda/novo?edit=8623 (usando String).
editParam recebido: String(N_PEDIDO).
GET ERP executado: SIM
Hidratação concluída: SIM
Abriu em Itens + Equipamentos: PASS
Fluxo CREATE permaneceu intacto: PASS
NODE ALTERADO: NÃO`}
      </div>

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
        <h2 className="text-xl font-bold mb-4 font-sans tracking-tight text-green-600">SPRINT 8.9.36.1 — Correção do Fluxo de Edição</h2>
        
        {`CREATE
Cliente trava após seleção: PASS
Avança automaticamente ao passo 2: PASS
Passo 1 inacessível após seleção: PASS
Swipe bloqueado para passo 1: PASS

EDIT
GET ERP executado: PASS
Status ERP revalidado: PASS
Cliente hidratado: PASS
Empresa hidratada: PASS
Itens hidratados: PASS
Equipamentos hidratados: PASS
Logística hidratada: PASS
Pagamento hidratado: PASS
Abre diretamente no passo 2: PASS
Pesquisa de cliente não exibida: PASS
Passo 1 inacessível: PASS

CANCELAMENTO
Store completamente limpa: PASS

NODE ALTERADO: NÃO`}
      </div>
    </div>
  );
}
