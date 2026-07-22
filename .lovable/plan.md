IMPLEMENTAR FLUXO OPERACIONAL DE ENTREGA E RECOLHIMENTO COM ATRIBUIÇÃO DE ENTREGADORES

&nbsp;

Trabalhar exclusivamente no módulo operacional local do projeto Lovable.

&nbsp;

Objetivo:

&nbsp;

Transformar o fluxo atual em um fluxo operacional confiável para:

&nbsp;

- atribuição de entregadores;

- início e conclusão de entregas;

- diferenciação entre pedidos com e sem equipamento retornável;

- criação e acompanhamento de recolhimentos;

- agendamento de recolhimento;

- opção “Cliente avisará”;

- histórico imutável;

- filtros operacionais;

- correção da reabertura do mesmo pedido.

&nbsp;

Antes de alterar qualquer arquivo, inspecione:

&nbsp;

- estrutura atual das tabelas do Lovable Cloud;

- enums atuais;

- operation_states;

- operation_events;

- perfis e usuários;

- RLS;

- RPCs existentes;

- componentes do mapa;

- detalhe do pedido;

- formato real de `order.equipments`;

- formato real de `order.items`;

- fluxo atual de abertura e fechamento do drawer;

- queries e mutations do módulo operacional.

&nbsp;

Não criar estruturas paralelas quando já houver estrutura equivalente.

&nbsp;

────────────────────────────────────────

RESTRIÇÕES OBRIGATÓRIAS

────────────────────────────────────────

&nbsp;

Não alterar:

&nbsp;

- backend Node;

- endpoints do Node;

- autenticação HMAC;

- Firebird;

- geocodificação;

- regra de empresa;

- DATA_PREV_ENTREGA;

- `.env`;

- marcadores dourados já aprovados;

- frontend não relacionado ao módulo operacional.

&nbsp;

O Firebird permanece estritamente somente leitura.

&nbsp;

Status esperado nesta fase:

&nbsp;

- Node: sem alteração;

- `.env`: sem alteração;

- Firebird: zero escrita;

- Lovable Cloud: pode receber migração versionada;

- frontend: atualização obrigatória.

&nbsp;

────────────────────────────────────────

1. PRINCÍPIO DE MODELAGEM

────────────────────────────────────────

&nbsp;

Não tratar entrega e recolhimento como o mesmo processo operacional.

&nbsp;

Modelar:

&nbsp;

PEDIDO

→ OPERAÇÃO DE ENTREGA

→ OPERAÇÃO DE RECOLHIMENTO, quando necessária

&nbsp;

Cada operação deve possuir seu próprio:

&nbsp;

- tipo;

- status;

- responsável;

- data agendada;

- início;

- conclusão;

- histórico;

- observações.

&nbsp;

Tipos mínimos:

&nbsp;

- delivery

- pickup

&nbsp;

Um pedido sem equipamento retornável terá somente operação de entrega.

&nbsp;

Um pedido com equipamento retornável terá:

&nbsp;

1. operação de entrega;

2. operação de recolhimento criada após a confirmação da entrega.

&nbsp;

────────────────────────────────────────

2. PRESERVAR ENUM ATUAL

────────────────────────────────────────

&nbsp;

Não renomear nem substituir o enum de status atual nesta fase.

&nbsp;

Não executar migração ampla de:

&nbsp;

pending

→ pending_delivery

&nbsp;

in_progress

→ delivery_in_progress

&nbsp;

ou equivalentes.

&nbsp;

Preservar os valores existentes no banco para reduzir risco.

&nbsp;

Criar uma camada de máquina de estados que interprete o estado atual conforme o tipo da operação.

&nbsp;

Exemplo:

&nbsp;

operation.type = delivery

status = pending

&nbsp;

Significa:

&nbsp;

- entrega pendente.

&nbsp;

operation.type = pickup

status = pending

&nbsp;

Significa:

&nbsp;

- recolhimento pendente.

&nbsp;

A UI deve mostrar rótulos amigáveis, sem depender do nome literal do enum.

&nbsp;

────────────────────────────────────────

3. TABELA DE OPERAÇÕES

────────────────────────────────────────

&nbsp;

Inspecionar se `operation_states` já pode representar múltiplas operações por pedido.

&nbsp;

Se a estrutura atual for um único registro por pedido, adaptar com segurança para permitir:

&nbsp;

- uma operação de entrega;

- zero ou uma operação de recolhimento ativa;

- histórico preservado.

&nbsp;

Estrutura conceitual mínima:

&nbsp;

operations ou operation_states:

&nbsp;

- id;

- company_id;

- erp_order_id;

- operation_type;

- status;

- scheduled_at;

- started_at;

- completed_at;

- created_at;

- updated_at;

- version;

- metadata jsonb, caso já exista estrutura equivalente.

&nbsp;

`operation_type`:

&nbsp;

- delivery;

- pickup.

&nbsp;

Não duplicar uma operação de entrega já existente.

&nbsp;

Não criar mais de uma operação de recolhimento ativa para o mesmo pedido.

&nbsp;

Criar restrição, RPC ou validação transacional para impedir duplicação.

&nbsp;

────────────────────────────────────────

4. EQUIPAMENTO RETORNÁVEL

────────────────────────────────────────

&nbsp;

Criar função pura e central:

&nbsp;

needsPickup(order)

&nbsp;

Arquivo sugerido:

&nbsp;

src/lib/operations/equipment.ts

&nbsp;

Regra atual:

&nbsp;

- utilizar exclusivamente `order.equipments`;

- itens de `order.items` não geram recolhimento;

- barril e growler presentes apenas em `items` não contam;

- se houver equipamento real no array `equipments`, o pedido exige recolhimento.

&nbsp;

Implementação inicial segura:

&nbsp;

- array inexistente ou vazio → false;

- ignorar equipamentos com quantidade zero;

- quantidade positiva ou item presente sem quantidade explícita → true.

&nbsp;

Não espalhar essa regra pela UI.

&nbsp;

Toda decisão deve chamar `needsPickup(order)`.

&nbsp;

Documentar:

&nbsp;

Hoje qualquer equipamento retornado pelo Node em `order.equipments` exige recolhimento.

&nbsp;

A função foi centralizada para permitir futuras exceções, como:

&nbsp;

- equipamento que não retorna;

- equipamento descartável;

- equipamento vendido;

- cilindro ou acessório com regra própria.

&nbsp;

────────────────────────────────────────

5. FLUXO SEM EQUIPAMENTO

────────────────────────────────────────

&nbsp;

Pedido sem equipamento retornável:

&nbsp;

1. operação de entrega criada ou carregada;

2. entregador atribuído;

3. entrega iniciada;

4. entrega confirmada;

5. operação de entrega concluída;

6. pedido sai dos filtros operacionais ativos;

7. nenhuma operação de recolhimento é criada.

&nbsp;

Fluxo:

&nbsp;

delivery.pending

→ delivery.in_progress

→ delivery.completed

&nbsp;

Após a conclusão:

&nbsp;

- bloquear novas ações operacionais incompatíveis;

- manter consulta ao histórico;

- permitir apenas observação administrativa se essa regra já existir e for autorizada.

&nbsp;

────────────────────────────────────────

6. FLUXO COM EQUIPAMENTO

────────────────────────────────────────

&nbsp;

Pedido com equipamento retornável:

&nbsp;

1. operação de entrega criada;

2. entregador atribuído;

3. entrega iniciada;

4. entrega confirmada;

5. operação de entrega concluída;

6. criar automaticamente uma operação de recolhimento;

7. abrir obrigatoriamente o modal de definição do recolhimento.

&nbsp;

A operação de entrega termina normalmente.

&nbsp;

O pedido permanece operacionalmente aberto por causa da operação de recolhimento.

&nbsp;

Fluxo:

&nbsp;

delivery.pending

→ delivery.in_progress

→ delivery.completed

&nbsp;

Depois:

&nbsp;

pickup.awaiting_definition

&nbsp;

A operação de recolhimento deve exigir uma das decisões:

&nbsp;

A. Agendar recolhimento

&nbsp;

ou

&nbsp;

B. Cliente avisará

&nbsp;

Não permitir que o usuário conclua a entrega com equipamento e deixe o pedido sem uma próxima ação registrada.

&nbsp;

────────────────────────────────────────

7. ESTADOS FUNCIONAIS DA OPERAÇÃO

────────────────────────────────────────

&nbsp;

Preservar o enum atual, mas implementar os seguintes estados funcionais na máquina de estados:

&nbsp;

ENTREGA:

&nbsp;

- pending;

- in_progress;

- completed;

- not_found;

- rescheduled;

- cancelled.

&nbsp;

RECOLHIMENTO:

&nbsp;

- awaiting_definition;

- awaiting_customer_contact;

- scheduled;

- in_progress;

- completed;

- not_found;

- rescheduled;

- cancelled.

&nbsp;

Se o enum atual não possuir todos os valores necessários, adicionar somente os novos valores indispensáveis, sem renomear os antigos.

&nbsp;

Evitar drop e recriação do enum.

&nbsp;

Preferir `ALTER TYPE ... ADD VALUE` ou estrutura equivalente segura.

&nbsp;

Documentar o mapeamento final entre:

&nbsp;

- valor de banco;

- tipo de operação;

- significado funcional;

- rótulo exibido.

&nbsp;

────────────────────────────────────────

8. MÁQUINA DE ESTADOS CENTRAL

────────────────────────────────────────

&nbsp;

Criar:

&nbsp;

src/lib/operations/state-machine.ts

&nbsp;

Funções mínimas:

&nbsp;

getAllowedOperationalActions(operation, orderContext)

&nbsp;

canTransition(operation, action, payload)

&nbsp;

nextState(operation, action)

&nbsp;

getOperationalLabel(operation)

&nbsp;

Não duplicar regras nos componentes.

&nbsp;

A UI apenas consulta a máquina de estados.

&nbsp;

A RPC do banco deve validar as mesmas regras.

&nbsp;

Ações mínimas:

&nbsp;

ENTREGA:

&nbsp;

- assign;

- start;

- confirm_delivery;

- customer_not_found;

- reschedule_delivery;

- cancel.

&nbsp;

RECOLHIMENTO:

&nbsp;

- define_pickup;

- customer_will_contact;

- schedule_pickup;

- assign;

- start;

- confirm_pickup;

- customer_not_found;

- reschedule_pickup;

- cancel.

&nbsp;

Exemplos obrigatórios:

&nbsp;

delivery.pending:

- assign;

- start;

- customer_not_found;

- reschedule_delivery.

&nbsp;

delivery.in_progress:

- confirm_delivery;

- customer_not_found;

- reschedule_delivery.

&nbsp;

delivery.completed:

- nenhuma alteração operacional.

&nbsp;

pickup.awaiting_definition:

- schedule_pickup;

- customer_will_contact.

&nbsp;

pickup.awaiting_customer_contact:

- schedule_pickup.

&nbsp;

pickup.scheduled:

- assign;

- start;

- reschedule_pickup;

- customer_not_found.

&nbsp;

pickup.in_progress:

- confirm_pickup;

- customer_not_found;

- reschedule_pickup.

&nbsp;

pickup.completed:

- nenhuma alteração operacional.

&nbsp;

Não apenas ocultar botões.

&nbsp;

Bloquear também no handler e na RPC.

&nbsp;

────────────────────────────────────────

9. ATRIBUIÇÕES EM TABELA PRÓPRIA

────────────────────────────────────────

&nbsp;

Não adicionar apenas:

&nbsp;

delivery_assignee_id

&nbsp;

e

&nbsp;

pickup_assignee_id

&nbsp;

na mesma linha de estado.

&nbsp;

Criar ou reutilizar uma tabela de atribuições.

&nbsp;

Nome sugerido:

&nbsp;

operation_assignments

&nbsp;

Campos mínimos:

&nbsp;

- id;

- company_id;

- operation_id;

- user_id;

- assigned_at;

- assigned_by;

- ended_at;

- ended_by;

- reason;

- is_active;

- created_at.

&nbsp;

Regra:

&nbsp;

- somente uma atribuição ativa por operação;

- uma troca encerra a atribuição anterior;

- manter histórico completo de responsáveis;

- entrega e recolhimento possuem atribuições independentes;

- o entregador da entrega pode ser diferente do responsável pelo recolhimento.

&nbsp;

Criar RPC:

&nbsp;

assign_operation_operator(

  _operation_id,

  _user_id,

  _expected_version,

  _reason

)

&nbsp;

A RPC deve:

&nbsp;

1. validar acesso à empresa;

2. validar operação;

3. validar usuário;

4. encerrar atribuição ativa anterior;

5. criar nova atribuição;

6. registrar evento;

7. incrementar versão;

8. retornar estado atualizado.

&nbsp;

Permitir:

&nbsp;

- selecionar responsável;

- trocar responsável;

- “Atribuir a mim”, quando aplicável.

&nbsp;

Não criar usuários falsos.

&nbsp;

Usar `profiles` existente.

&nbsp;

────────────────────────────────────────

10. RPC CENTRAL DE TRANSIÇÃO

────────────────────────────────────────

&nbsp;

Criar ou adaptar uma RPC central:

&nbsp;

apply_operation_transition(

  _operation_id,

  _action,

  _expected_version,

  _payload jsonb

)

&nbsp;

A RPC deve:

&nbsp;

- validar autenticação;

- validar acesso à empresa;

- verificar versão otimista;

- carregar tipo e estado atual;

- validar transição;

- rejeitar ação incompatível;

- atualizar estado;

- registrar timestamps;

- registrar evento imutável;

- impedir duplicidade;

- retornar operação atualizada.

&nbsp;

Não confiar apenas no frontend.

&nbsp;

Exemplos de payload:

&nbsp;

Iniciar:

&nbsp;

{

  "note": null

}

&nbsp;

Confirmar entrega:

&nbsp;

{

  "erpOrderId": 8433,

  "hasReturnableEquipment": true

}

&nbsp;

Agendar recolhimento:

&nbsp;

{

  "scheduledAt": "2026-07-25T14:00:00-03:00",

  "assigneeId": "...",

  "note": "..."

}

&nbsp;

Cliente avisará:

&nbsp;

{

  "note": "Cliente solicitará retirada quando terminar o evento"

}

&nbsp;

Não localizado:

&nbsp;

{

  "context": "delivery",

  "note": "..."

}

&nbsp;

ou:

&nbsp;

{

  "context": "pickup",

  "note": "..."

}

&nbsp;

A RPC não deve confiar cegamente em `hasReturnableEquipment` enviado pelo cliente.

&nbsp;

Sempre que possível, usar metadado persistido no momento da criação da operação ou validar contra o snapshot local da ordem.

&nbsp;

────────────────────────────────────────

11. SNAPSHOT OPERACIONAL DO PEDIDO

────────────────────────────────────────

&nbsp;

Como o Firebird é somente leitura e os dados podem mudar, preservar no Lovable Cloud um snapshot mínimo usado na operação.

&nbsp;

No momento em que o pedido é carregado ou a operação é criada, armazenar em metadata ou estrutura equivalente:

&nbsp;

- erpOrderId;

- orderNumber;

- customerName;

- address;

- deliveryDate;

- deliveryTime;

- equipmentSummary;

- hasReturnableEquipment;

- itemSummary.

&nbsp;

Esse snapshot não substitui o Node.

&nbsp;

Serve apenas para:

&nbsp;

- histórico;

- consistência da operação;

- saber se deveria existir recolhimento;

- evitar que uma mudança posterior no ERP altere retroativamente o fluxo já executado.

&nbsp;

Não persistir dados sensíveis desnecessários.

&nbsp;

────────────────────────────────────────

12. CONFIRMAÇÃO DE ENTREGA

────────────────────────────────────────

&nbsp;

Ao confirmar entrega:

&nbsp;

SE `needsPickup(order) === false`:

&nbsp;

- concluir operação de entrega;

- registrar DELIVERY_COMPLETED;

- registrar OPERATION_COMPLETED;

- não criar pickup;

- atualizar mapa, lista, filtros e contadores.

&nbsp;

SE `needsPickup(order) === true`:

&nbsp;

- concluir operação de entrega;

- registrar DELIVERY_COMPLETED;

- criar operação de pickup;

- status inicial funcional: awaiting_definition;

- registrar PICKUP_CREATED;

- abrir modal obrigatório “Definir recolhimento do equipamento”.

&nbsp;

A criação do pickup deve ser transacional e idempotente.

&nbsp;

Não criar duas operações de pickup por duplo clique ou retry.

&nbsp;

────────────────────────────────────────

13. MODAL DE DEFINIÇÃO DO RECOLHIMENTO

────────────────────────────────────────

&nbsp;

Após entregar pedido com equipamento, abrir:

&nbsp;

Título:

&nbsp;

Definir recolhimento do equipamento

&nbsp;

Mostrar:

&nbsp;

- cliente;

- pedido;

- equipamentos;

- quantidade;

- responsável da entrega;

- data da entrega.

&nbsp;

Opções:

&nbsp;

A. Agendar recolhimento

&nbsp;

Campos:

&nbsp;

- data obrigatória;

- horário opcional;

- responsável opcional inicialmente;

- observação opcional.

&nbsp;

Se horário não for informado, usar convenção definida pelo projeto.

&nbsp;

Não inventar automaticamente horário atual.

&nbsp;

B. Cliente avisará

&nbsp;

Texto:

&nbsp;

Cliente avisará

&nbsp;

Confirmação:

&nbsp;

Confirmar que o cliente avisará quando o equipamento estiver disponível para recolhimento?

&nbsp;

Estado resultante:

&nbsp;

pickup.awaiting_customer_contact

&nbsp;

Registrar próxima ação visível:

&nbsp;

Aguardando contato do cliente para agendar recolhimento.

&nbsp;

Não permitir o texto ambíguo “Cliente avisa”.

&nbsp;

────────────────────────────────────────

14. PRÓXIMA AÇÃO

────────────────────────────────────────

&nbsp;

Toda operação ativa deve expor uma próxima ação clara.

&nbsp;

Exemplos:

&nbsp;

- Entrega pendente.

- Entrega em andamento.

- Aguardando definição do recolhimento.

- Aguardando o cliente avisar.

- Recolhimento agendado para 25/07/2026 às 14:00.

- Recolhimento em andamento.

- Operação concluída.

&nbsp;

Adicionar seção compacta no detalhe:

&nbsp;

Status atual

&nbsp;

Responsável

&nbsp;

Próxima ação

&nbsp;

Agendamento

&nbsp;

Quando houver pickup:

&nbsp;

Recolhimento:

Aguardando cliente avisar

&nbsp;

ou:

&nbsp;

Recolhimento:

25/07/2026 às 14:00

&nbsp;

Responsável:

João

&nbsp;

O operador não deve depender apenas do histórico para saber o que fazer.

&nbsp;

────────────────────────────────────────

15. REAGENDAMENTO

────────────────────────────────────────

&nbsp;

Não usar um botão ambíguo sem contexto.

&nbsp;

A ação deve identificar:

&nbsp;

- reagendar entrega;

- reagendar recolhimento.

&nbsp;

Eventos separados:

&nbsp;

- DELIVERY_RESCHEDULED;

- PICKUP_SCHEDULED;

- PICKUP_RESCHEDULED.

&nbsp;

Registrar:

&nbsp;

- valor anterior;

- valor novo;

- usuário;

- responsável;

- motivo;

- timestamp.

&nbsp;

No frontend, o rótulo pode variar conforme a operação ativa:

&nbsp;

- Reagendar entrega;

- Reagendar recolhimento.

&nbsp;

────────────────────────────────────────

16. NÃO LOCALIZADO

────────────────────────────────────────

&nbsp;

Separar semanticamente:

&nbsp;

- DELIVERY_CUSTOMER_NOT_FOUND;

- PICKUP_CUSTOMER_NOT_FOUND.

&nbsp;

Não finalizar automaticamente.

&nbsp;

Depois de “Não localizado”:

&nbsp;

- registrar tentativa;

- manter histórico;

- permitir reagendar;

- preservar responsável;

- mostrar próxima ação;

- impedir evento duplicado por clique duplo.

&nbsp;

A UI deve mostrar em qual contexto ocorreu:

&nbsp;

- tentativa de entrega;

- tentativa de recolhimento.

&nbsp;

────────────────────────────────────────

17. HISTÓRICO PADRONIZADO

────────────────────────────────────────

&nbsp;

Adotar padrão definitivo de eventos.

&nbsp;

Eventos mínimos:

&nbsp;

- ORDER_LOADED;

- OPERATION_NOTE_ADDED;

- DELIVERY_ASSIGNED;

- DELIVERY_ASSIGNEE_CHANGED;

- DELIVERY_STARTED;

- DELIVERY_COMPLETED;

- DELIVERY_CUSTOMER_NOT_FOUND;

- DELIVERY_RESCHEDULED;

- PICKUP_CREATED;

- CUSTOMER_WILL_CONTACT;

- PICKUP_SCHEDULED;

- PICKUP_RESCHEDULED;

- PICKUP_ASSIGNED;

- PICKUP_ASSIGNEE_CHANGED;

- PICKUP_STARTED;

- PICKUP_CUSTOMER_NOT_FOUND;

- PICKUP_COMPLETED;

- OPERATION_COMPLETED;

- OPERATION_CANCELLED.

&nbsp;

Manter eventos antigos por compatibilidade histórica.

&nbsp;

Não apagar nem editar eventos antigos.

&nbsp;

Cada evento deve conter:

&nbsp;

- operation_id;

- erp_order_id;

- type;

- actor_user_id;

- assigned_user_id, quando aplicável;

- created_at;

- source;

- description;

- metadata;

- before;

- after.

&nbsp;

Rótulos da timeline devem ser amigáveis em português.

&nbsp;

────────────────────────────────────────

18. CORRIGIR REABERTURA DO MESMO PEDIDO

────────────────────────────────────────

&nbsp;

Bug confirmado:

&nbsp;

1. abre pedido;

2. fecha;

3. toca no mesmo marcador;

4. pedido não abre;

5. só volta a abrir após selecionar outro pedido.

&nbsp;

Corrigir em `_authenticated.index.tsx` ou componente equivalente.

&nbsp;

Ao fechar:

&nbsp;

- limpar selectedOrderId;

- limpar selectedOrder;

- limpar estados internos do drawer;

- limpar operação ativa;

- incrementar open sequence, se necessário.

&nbsp;

Ao abrir:

&nbsp;

- sempre executar rotina de abertura;

- permitir abrir o mesmo ID novamente;

- não ignorar clique porque o ID é igual ao anterior.

&nbsp;

Usar, se necessário:

&nbsp;

key={`${orderId}-${openSeq}`}

&nbsp;

Testar:

&nbsp;

- abrir 8433;

- fechar;

- abrir 8433 novamente;

- repetir três vezes;

- abrir 8434;

- voltar para 8433;

- usar botão voltar do Android;

- fechar por gesto;

- fechar pelo X;

- abrir pela lista;

- abrir pelo marcador.

&nbsp;

────────────────────────────────────────

19. UI DO DETALHE

────────────────────────────────────────

&nbsp;

Reorganizar o detalhe sem perder o layout mobile atual.

&nbsp;

Adicionar:

&nbsp;

Resumo operacional

&nbsp;

- status da entrega;

- entregador;

- status do recolhimento;

- responsável pelo recolhimento;

- próxima ação;

- agendamento.

&nbsp;

Ações devem depender da operação ativa.

&nbsp;

Não mostrar todos os botões ao mesmo tempo.

&nbsp;

Exemplo durante entrega pendente:

&nbsp;

- Atribuir entregador;

- Iniciar;

- Não localizado;

- Reagendar entrega.

&nbsp;

Durante entrega em andamento:

&nbsp;

- Entregar;

- Não localizado;

- Reagendar entrega.

&nbsp;

Durante pickup aguardando cliente:

&nbsp;

- Agendar recolhimento.

&nbsp;

Durante pickup agendado:

&nbsp;

- Atribuir responsável;

- Iniciar recolhimento;

- Reagendar recolhimento;

- Não localizado.

&nbsp;

Durante pickup em andamento:

&nbsp;

- Confirmar recolhimento;

- Não localizado;

- Reagendar recolhimento.

&nbsp;

Concluído:

&nbsp;

- nenhum botão de transição.

&nbsp;

────────────────────────────────────────

20. FILTROS OPERACIONAIS

────────────────────────────────────────

&nbsp;

Atualizar filtros para refletir operações reais.

&nbsp;

Filtros mínimos:

&nbsp;

- Todos;

- Entregas pendentes;

- Em entrega;

- Aguardando recolhimento;

- Recolhimentos agendados;

- Em recolhimento;

- Finalizados.

&nbsp;

No mobile:

&nbsp;

- scroll horizontal;

- contadores visíveis;

- sem quebrar o mapa.

&nbsp;

Pedidos concluídos sem equipamento saem dos filtros ativos.

&nbsp;

Pedidos com pickup permanecem ativos até o recolhimento ser concluído.

&nbsp;

────────────────────────────────────────

21. MAPA

────────────────────────────────────────

&nbsp;

Preservar:

&nbsp;

- formato atual;

- marcador dourado;

- tamanho aprovado;

- horário ao lado do pedido.

&nbsp;

Não criar cartões brancos.

&nbsp;

Adicionar apenas uma identificação discreta para operação de pickup, por exemplo:

&nbsp;

- pequeno ponto interno;

- miniícone;

- borda;

- badge pequena.

&nbsp;

Não alterar o marcador principal.

&nbsp;

A legenda deve explicar os estados, caso exista diferenciação visual.

&nbsp;

────────────────────────────────────────

22. ATUALIZAÇÃO DE QUERIES

────────────────────────────────────────

&nbsp;

Após qualquer mutation, invalidar e recarregar:

&nbsp;

- operação atual;

- operações do pedido;

- atribuições;

- histórico;

- observações;

- pedidos do mapa;

- lista;

- contadores;

- filtros;

- resumo operacional.

&nbsp;

Queries sugeridas:

&nbsp;

- operation-states;

- operation-assignments;

- operation-events;

- operation-notes;

- erp-map;

- operational-counters;

- active-operations.

&nbsp;

Não deixar a interface com estado antigo até reload manual.

&nbsp;

────────────────────────────────────────

23. IDEMPOTÊNCIA

────────────────────────────────────────

&nbsp;

Todas as ações precisam impedir duplicidade.

&nbsp;

Frontend:

&nbsp;

- desabilitar botão durante mutation;

- loading;

- impedir clique repetido;

- preservar formulário em erro.

&nbsp;

Banco/RPC:

&nbsp;

- expected_version;

- validação do estado atual;

- chave de idempotência ou deduplicação por evento/transição;

- restrição contra pickup duplicado;

- transação atômica.

&nbsp;

Casos obrigatórios:

&nbsp;

- duplo clique em Entregar não cria duas 