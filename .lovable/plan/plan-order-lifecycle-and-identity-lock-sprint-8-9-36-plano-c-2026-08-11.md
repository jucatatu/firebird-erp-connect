# Plan: Order Lifecycle and Identity Lock (Sprint 8.9.36)Plano: Ciclo de Vida do Pedido e Bloqueio da Identidade — Sprint 8.9.36

Este plano implementa um fluxo arquitetural rígido para o Wizard de Pedidos, garantindo que, depois que cliente e empresa forem definidos, essa identidade permaneça imutável durante todo o ciclo de vida do pedido.

Também melhora o comportamento do Modo Edição e adiciona proteções de navegação.

Pontos para decisão

Depois do Passo 1, trocar o cliente exigirá cancelar o pedido atual e iniciar outro.

A navegação por gesto será bloqueada para impedir retorno ao Passo 1 depois que o cliente for selecionado.

O modo edição ignorará completamente o Passo 1 e mostrará apenas um cabeçalho informativo com cliente e empresa.

Decisões recomendadas:

Confirmação de Cancelar Pedido/Edição: aprovada.

No mobile, depois do bloqueio da identidade: ocultar a aba Cliente.

No desktop, ela pode permanecer visível como concluída/bloqueada, mas nunca clicável.

Alterações propostas

Frontend — Store e Estado

Arquivo:

src/hooks/use-order-form.ts

Adicionar:

identityLocked: boolean

ao OrderFormStore.

Alterar setClient para:

definir o cliente;

garantir o companyId;

definir:

identityLocked = true

Alterar reset para limpar:

identityLocked

cliente

empresa

itens

equipamentos

entrega

pagamento

modo edição

erpOrderNumber

Alterar editErpOrder para definir:

identityLocked = true

submissionStatus = "editing"

Frontend — Wizard e Navegação

Arquivo:

src/routes/_authenticated.pedidos-venda.novo.tsx

1. Ciclo de vida e hidratação da edição

Refatorar o useEffect responsável pelo editParam.

Ao acessar, por exemplo:

/pedidos-venda/novo?edit=8623

o sistema deverá:

buscar pedido ERP

↓

validar status

↓

hidratar a store completamente

↓

bloquear identidade

↓

definir etapa = items

↓

liberar o wizard

A hidratação deve ser atômica.

Enquanto estiver carregando o pedido:

não mostrar seleção de cliente;

não liberar interação no wizard;

mostrar loading apropriado.

Somente depois da hidratação completa:

setStep("items")

2. Proteções de navegação

Alterar a lógica de setStep.

Se:

identityLocked === true

então:

setStep("client")

deve ser rejeitado.

Isso precisa valer independentemente da origem da chamada.

Ou seja, não basta bloquear apenas visualmente.

Deve funcionar para:

clique na aba;

swipe;

botão voltar;

código programático.

3. Abas do Wizard

Antes de selecionar cliente

Mostrar:

1. Cliente

2. Itens + Equipamentos

3. Entrega

4. Pagamento

5. Revisão

Os passos posteriores continuam protegidos enquanto não houver cliente.

Depois de selecionar cliente

No mobile, mostrar somente:

2. Itens + Equipamentos

3. Entrega

4. Pagamento

5. Revisão

A aba Cliente desaparece da navegação.

No desktop, opcionalmente pode aparecer como:

✓ Cliente

mas:

desabilitada;

não clicável;

sem possibilidade de retornar.

4. Navegação por gesto

Usando react-swipeable, aplicar a seguinte regra:

No Passo 2:

onSwipedRight: () => {

  if (identityLocked) return

}

Portanto:

Passo 2

← swipe → Passo 3

→ swipe → nada

Depois:

Passo 3 ↔ Passo 2 / Passo 4

Passo 4 ↔ Passo 3 / Passo 5

Passo 5 → Passo 4

Depois que a identidade estiver travada, o Passo 2 passa a ser o limite mínimo do wizard.

5. Cabeçalho persistente da identidade

Depois da escolha do cliente, mostrar um cabeçalho compacto.

Exemplo para criação:

PEDIDO PARA:

CERVEJARIA GRAAL BEER LTDA

GRAAL

Exemplo para edição:

EDITANDO PEDIDO ERP 8623

CERVEJARIA GRAAL BEER LTDA

GRAAL

ERP: EM ANÁLISE

Esse bloco é apenas informativo.

Não permitir edição de:

cliente;

empresa.

Incluir nele ou em local apropriado a ação:

Cancelar pedido

ou, no modo edição:

Cancelar edição

6. Passo 1 — Seleção de cliente

Ao clicar em um resultado da pesquisa:

setClient(id, name)

deve executar imediatamente:

identityLocked = true

setStep("items")

Portanto, não deve ser necessário:

selecionar cliente

↓

clicar Próximo

O comportamento passa a ser:

selecionar cliente

↓

abre Itens + Equipamentos

7. Modo Edição

No modo edição, o usuário nunca deve passar pela tela de seleção de cliente.

Ao clicar em:

Editar pedido

fluxo obrigatório:

Pedido ERP

↓

GET /api/v1/orders/:orderNumber

↓

validar status

↓

carregar pedido completo

↓

hidratar store

↓

identityLocked = true

↓

mode = edit

↓

currentStep = 2

↓

abrir Itens + Equipamentos

Não mostrar durante esse fluxo:

busca de clientes;

últimos pedidos;

botões GRAAL/GROTT;

Passo 1 ativo.

8. Dados obrigatórios na edição

Antes de considerar a hidratação concluída, carregar:

N_PEDIDO

ID_ORDENS_VENDA

empresa

cliente

itens

quantidades

preços

preços alterados manualmente

equipamentos

vínculo barril → produto

chopeiras

entrega ou retirada

data de entrega

data de recolhimento

horário

forma de pagamento

condição de pagamento

tipo de venda

observações

A edição deverá reutilizar exatamente o mesmo wizard do cadastro.

Não criar uma tela de edição separada ou simplificada.

9. Cancelamento

Depois que identityLocked = true, disponibilizar uma ação explícita.

Novo pedido

Cancelar pedido

Edição

Cancelar edição

Ao clicar:

Deseja cancelar?

&nbsp;

As alterações não salvas serão perdidas.

&nbsp;

[Continuar editando] [Cancelar pedido]

Se confirmar:

reset completo da store

↓

limpar modo edição

↓

limpar identityLocked

↓

limpar itens

↓

limpar equipamentos

↓

limpar entrega

↓

limpar pagamento

↓

/pedidos-venda

10. Persistência Zustand

Persistir:

identityLocked

mode

erpOrderNumber

currentStep

junto com os dados necessários da sessão.

Isso evita que um refresh no navegador devolva o usuário à seleção do cliente durante um pedido já iniciado.

Entretanto, o sistema deve validar os dados persistidos para não restaurar uma sessão finalizada ou cancelada.

11. Salvamento

Novo pedido

Continuar utilizando o fluxo atual:

POST ERP

↓

sucesso

↓

snapshot Supabase

↓

invalidar queries

↓

reset store

↓

lista de pedidos

Edição

Utilizar:

PUT /api/v1/orders/:orderNumber

Antes de qualquer alteração no Firebird, o Node deverá consultar novamente o status real.

Permitir somente:

1  LIBERADO

20 ENTREGA ATRASADA

24 ATRASADO

27 EM ANÁLISE

Se o pedido mudou de status durante a edição:

bloquear alteração

não executar UPDATE

informar o usuário

12. Backend

Verificar a lógica em:

erp-api/src/modules/orders/orders.service.js

para confirmar que o updateOrder revalida diretamente no Firebird o status do pedido.

Não confiar em:

snapshot Supabase;

status enviado pelo frontend;

status carregado ao abrir a edição.

A fonte oficial continua sendo o Firebird no momento do PUT.

Importante

Não modificar o Node apenas por precaução.

Se a API atual já fornece tudo, manter.

Se realmente precisar mudar:

NODE ALTERADO: SIM

&nbsp;

Arquivo:

Endpoint:

Alteração:

Motivo:

Critérios de aceite

Criação

Selecionar empresa

→ pesquisar cliente

→ clicar cliente

Resultado:

cliente definido;

empresa definida;

identityLocked = true;

abre imediatamente o Passo 2;

não existe retorno ao Passo 1;

swipe não retorna ao cliente;

pedido pode prosseguir normalmente até o Passo 5.

Edição

Exemplo:

Pedido ERP 8623

→ Editar pedido

Resultado:

consulta ERP executada;

status validado;

cliente carregado;

empresa carregada;

itens carregados;

equipamentos carregados;

entrega carregada;

pagamento carregado;

abre diretamente em Itens + Equipamentos;

Passo 1 não aparece no mobile;

não aparece pesquisa de cliente;

cliente não pode ser trocado.

Cancelamento

Ao cancelar:

store completamente limpa;

nenhuma informação do pedido anterior permanece;

retorno para lista;

próximo Novo Pedido começa novamente no Passo 1.