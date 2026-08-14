# PLAN — SPRINT 8.9.40 — PEDIDOS EXCLUÍDOS DO ERP COM MIGRAÇÃO SEGURA DO BATCH-STATUS

&nbsp;

## OBJETIVO

&nbsp;

Identificar corretamente pedidos que foram excluídos do ERP após terem sido

espelhados no Supabase.

&nbsp;

Esses pedidos devem:

&nbsp;

- permanecer no histórico do app;

- mostrar "ERP: EXCLUÍDO";

- não permitir edição;

- não permitir PUT;

- não aparecer como operação ativa;

- não ter order_drafts.status sobrescrito;

- nunca ser considerados excluídos por falha de conexão.

&nbsp;

NÃO alterar CREATE.

NÃO alterar edição de pedido ativo já validada.

NÃO alterar equipamentos/cobertura.

NÃO alterar pagamentos/ID_FPGTO.

NÃO alterar Google Maps/logística.

&nbsp;

==================================================

1. IDENTIFICADORES — REGRA DEFINITIVA

==================================================

&nbsp;

Existem dois identificadores distintos:

&nbsp;

ID_ORDENS_VENDA

= ID interno Firebird.

&nbsp;

N_PEDIDO

= número comercial exibido no app.

&nbsp;

Para sincronização de status ERP, o identificador oficial será:

&nbsp;

N_PEDIDO

=

erp_order_number

&nbsp;

O novo contrato deve utilizar explicitamente:

&nbsp;

orderNumbers

&nbsp;

Nunca chamar N_PEDIDO de orderId internamente.

&nbsp;

==================================================

2. RISCO DE COMPATIBILIDADE — NÃO TRATAR orderIds COMO ALIAS CEGO

==================================================

&nbsp;

ATENÇÃO:

&nbsp;

O frontend antigo pode enviar:

&nbsp;

orderIds=<ID_ORDENS_VENDA interno>

&nbsp;

Enquanto o novo frontend enviará:

&nbsp;

orderNumbers=<N_PEDIDO>

&nbsp;

Portanto NÃO fazer:

&nbsp;

const orderNumbers =

  req.query.orderNumbers ?? req.query.orderIds;

&nbsp;

Isso seria perigoso.

&nbsp;

Se o frontend antigo enviar IDs internos e o backend tratá-los como N_PEDIDO,

a nova regra "não encontrado = excluído" poderia marcar pedidos ativos como

EXCLUÍDOS.

&nbsp;

==================================================

3. CONTRATO DE MIGRAÇÃO SEGURO

==================================================

&nbsp;

Endpoint:

&nbsp;

GET /api/v1/orders/batch-status

&nbsp;

Suportar temporariamente DOIS contratos explícitos:

&nbsp;

A) NOVO CONTRATO

&nbsp;

?orderNumbers=8654,8666

&nbsp;

Semântica:

&nbsp;

valores são ORDENS_VENDA.N_PEDIDO.

&nbsp;

Este contrato pode detectar:

&nbsp;

- ativo;

- exclusão lógica;

- exclusão física.

&nbsp;

B) CONTRATO LEGADO

&nbsp;

?orderIds=12345,12346

&nbsp;

Semântica:

&nbsp;

valores são ORDENS_VENDA.ID_ORDENS_VENDA.

&nbsp;

Preservar o significado histórico de ID interno.

&nbsp;

NÃO usar ausência de um orderId legado para inferir exclusão física.

&nbsp;

O novo frontend deverá migrar imediatamente para orderNumbers.

&nbsp;

Depois que a migração estiver comprovada, orderIds poderá ser depreciado

em Sprint futura.

&nbsp;

==================================================

4. REPOSITORY — STATUS POR N_PEDIDO

==================================================

&nbsp;

Em:

&nbsp;

erp-api/src/modules/orders/orders.repository.js

&nbsp;

manter/criar:

&nbsp;

findStatusByNumbers(orderNumbers)

&nbsp;

SQL:

&nbsp;

SELECT

  ov.ID_ORDENS_VENDA,

  ov.N_PEDIDO,

  ov.ID_STATUS,

  ov.DELETED,

  s.DESCRICAO AS STATUS_DESCRICAO

FROM ORDENS_VENDA ov

LEFT JOIN STATUS s

  ON s.ID_STATUS = ov.ID_STATUS

WHERE ov.N_PEDIDO IN (...)

&nbsp;

NÃO adicionar:

&nbsp;

DELETED = 0

&nbsp;

NÃO adicionar:

&nbsp;

DELETED IS NULL

&nbsp;

Precisamos enxergar registros logicamente excluídos.

&nbsp;

==================================================

5. REPOSITORY — CONTRATO LEGADO POR ID INTERNO

==================================================

&nbsp;

Se orderIds precisar permanecer temporariamente compatível:

&nbsp;

implementar função separada:

&nbsp;

findStatusByIds(orderIds)

&nbsp;

usando:

&nbsp;

WHERE ov.ID_ORDENS_VENDA IN (...)

&nbsp;

Não misturar essa função com findStatusByNumbers.

&nbsp;

Adicionar comentário:

&nbsp;

LEGACY — remover após migração completa do frontend.

&nbsp;

==================================================

6. NORMALIZAÇÃO DE DELETED

==================================================

&nbsp;

Auditar o tipo real retornado pelo Firebird.

&nbsp;

Criar uma função explícita:

&nbsp;

isDeletedValue(value)

&nbsp;

que considere corretamente o formato existente no banco.

&nbsp;

Não assumir cegamente apenas:

&nbsp;

value !== 0

&nbsp;

se o driver puder retornar:

&nbsp;

null

0

1

"0"

"1"

false

true

&nbsp;

Normalizar de maneira segura conforme o contrato real encontrado.

&nbsp;

Resultado final:

&nbsp;

deleted: boolean

&nbsp;

==================================================

7. NOVO BATCH POR N_PEDIDO — RESPONDER TODOS

==================================================

&nbsp;

Para:

&nbsp;

?orderNumbers=8654,8666

&nbsp;

getBatchStatusByNumbers deve produzir UMA resposta para CADA número solicitado.

&nbsp;

Contrato:

&nbsp;

{

  orderId: number | null,

  orderNumber: number,

  exists: boolean,

  deleted: boolean,

  statusId: number | null,

  statusDescription: string | null,

  canEdit: boolean

}

&nbsp;

==================================================

8. PEDIDO ATIVO

==================================================

&nbsp;

Registro encontrado e não deletado:

&nbsp;

{

  orderId: <ID_ORDENS_VENDA>,

  orderNumber: <N_PEDIDO>,

  exists: true,

  deleted: false,

  statusId: <ID_STATUS>,

  statusDescription: <STATUS>,

  canEdit: canEditErpOrder(ID_STATUS)

}

&nbsp;

Whitelist atual de edição permanece:

&nbsp;

[1, 20, 24, 27]

&nbsp;

==================================================

9. EXCLUSÃO LÓGICA

==================================================

&nbsp;

Registro encontrado com DELETED ativo:

&nbsp;

{

  orderId: <ID_ORDENS_VENDA>,

  orderNumber: <N_PEDIDO>,

  exists: true,

  deleted: true,

  statusId: null,

  statusDescription: "EXCLUÍDO",

  canEdit: false

}

&nbsp;

DELETED tem prioridade absoluta sobre ID_STATUS.

&nbsp;

Mesmo que ID_STATUS seja 27:

&nbsp;

canEdit = false.

&nbsp;

==================================================

10. EXCLUSÃO FÍSICA

==================================================

&nbsp;

Somente no NOVO contrato por N_PEDIDO:

&nbsp;

Se:

&nbsp;

- request ao Firebird terminou com SUCESSO;

- o batch recebeu N_PEDIDO conhecido pelo app;

- esse N_PEDIDO não apareceu no resultado;

&nbsp;

retornar:

&nbsp;

{

  orderId: null,

  orderNumber: <N_PEDIDO>,

  exists: false,

  deleted: true,

  statusId: null,

  statusDescription: "EXCLUÍDO",

  canEdit: false

}

&nbsp;

Essa ausência é uma conclusão operacional baseada em uma consulta válida.

&nbsp;

==================================================

11. FALHA TÉCNICA NUNCA SIGNIFICA EXCLUSÃO

==================================================

&nbsp;

Se ocorrer:

&nbsp;

- timeout;

- Node offline;

- Firebird offline;

- ECONNREFUSED;

- erro SQL;

- autenticação;

- HTTP 500;

- falha de rede;

&nbsp;

NÃO construir objetos deleted=true.

&nbsp;

Propagar erro.

&nbsp;

Frontend deverá tratar como:

&nbsp;

ERP: INDISPONÍVEL

&nbsp;

Nunca:

&nbsp;

ERP: EXCLUÍDO.

&nbsp;

==================================================

12. GET DETALHADO PRECISA ENXERGAR DELETED

==================================================

&nbsp;

Auditar:

&nbsp;

fetchOrderByNumber(orderNumber)

&nbsp;

A consulta usada pelo GET:

&nbsp;

/api/v1/orders/:orderNumber

&nbsp;

NÃO pode esconder registros com:

&nbsp;

DELETED != 0

&nbsp;

antes do service verificar esse campo.

&nbsp;

Se existir filtro equivalente a:

&nbsp;

DELETED = 0

&nbsp;

remover somente desse fluxo onde precisamos distinguir:

&nbsp;

ORDER_DELETED

de

ORDER_NOT_FOUND.

&nbsp;

==================================================

13. GET DE PEDIDO LOGICAMENTE EXCLUÍDO

==================================================

&nbsp;

getOrderDetail(orderNumber):

&nbsp;

1. localizar por N_PEDIDO;

2. verificar DELETED;

3. somente depois carregar detalhes.

&nbsp;

Se deleted:

&nbsp;

HTTP 410

&nbsp;

{

  code: "ORDER_DELETED",

  message: "Pedido excluído do ERP."

}

&nbsp;

Não retornar 404 nesse cenário.

&nbsp;

==================================================

14. GET DE PEDIDO FISICAMENTE INEXISTENTE

==================================================

&nbsp;

Se nenhum registro for encontrado:

&nbsp;

HTTP 404

&nbsp;

ORDER_NOT_FOUND

&nbsp;

Não transformar todo 404 da API em exclusão.

&nbsp;

A inferência de exclusão física pertence ao batch da listagem, pois ali o app

já possui um vínculo histórico conhecido com aquele N_PEDIDO.

&nbsp;

==================================================

15. PUT PRECISA REVALIDAR DELETED

==================================================

&nbsp;

updateOrder(orderNumber):

&nbsp;

recarregar o pedido diretamente do Firebird antes de alterar.

&nbsp;

Ordem:

&nbsp;

localizar N_PEDIDO

↓

verificar DELETED

↓

verificar status editável

↓

executar atualização

&nbsp;

Se deleted:

&nbsp;

HTTP 410

ORDER_DELETED

&nbsp;

Não chegar à validação de status.

&nbsp;

==================================================

16. FRONTEND — MIGRAR PARA orderNumbers

==================================================

&nbsp;

Em:

&nbsp;

src/lib/erp-orders.functions.ts

&nbsp;

alterar:

&nbsp;

getErpOrdersStatus(orderNumbers: number[])

&nbsp;

para enviar:

&nbsp;

?orderNumbers=...

&nbsp;

Não enviar orderIds no novo frontend.

&nbsp;

==================================================

17. INTERFACE FRONTEND

==================================================

&nbsp;

ErpOrderStatus:

&nbsp;

{

  orderId: number | null;

  orderNumber: number;

  exists: boolean;

  deleted: boolean;

  statusId: number | null;

  statusDescription: string | null;

  canEdit: boolean;

}

&nbsp;

==================================================

18. LISTA — USAR erp_order_number

==================================================

&nbsp;

Em:

&nbsp;

src/routes/_authenticated.pedidos-venda.index.tsx

&nbsp;

extrair:

&nbsp;

rows

  .map(row => row.erp_order_number)

&nbsp;

Não utilizar:

&nbsp;

erp_order_id

&nbsp;

para batch-status.

&nbsp;

statusMap:

&nbsp;

Map<number, ErpOrderStatus>

&nbsp;

chave:

&nbsp;

status.orderNumber

&nbsp;

Lookup:

&nbsp;

statusMap.get(draft.erp_order_number)

&nbsp;

==================================================

19. BADGES

==================================================

&nbsp;

Ativo:

&nbsp;

ERP: EM ANÁLISE

ERP: LIBERADO

etc.

&nbsp;

Excluído:

&nbsp;

ERP: EXCLUÍDO

&nbsp;

Visual diferente dos estados normais.

&nbsp;

Usar destructive/vermelho suave ou equivalente.

&nbsp;

Indisponível:

&nbsp;

ERP: INDISPONÍVEL

&nbsp;

Visual neutro/cinza.

&nbsp;

EXCLUÍDO e INDISPONÍVEL não podem compartilhar a mesma lógica.

&nbsp;

==================================================

20. DETALHE DO PEDIDO

==================================================

&nbsp;

No detalhe utilizar também:

&nbsp;

erp_order_number

&nbsp;

Se:

&nbsp;

erpStatus.deleted === true

&nbsp;

mostrar:

&nbsp;

ERP: EXCLUÍDO

&nbsp;

Mensagem:

&nbsp;

"Este pedido não existe mais no ERP e foi mantido no aplicativo apenas para histórico."

&nbsp;

Ocultar/desabilitar:

&nbsp;

Editar pedido.

&nbsp;

==================================================

21. REGRA canEdit DO FRONTEND

==================================================

&nbsp;

Editar somente quando:

&nbsp;

erpStatus.exists === true

&&

erpStatus.deleted === false

&&

erpStatus.canEdit === true

&nbsp;

Não avaliar apenas statusId.

&nbsp;

==================================================

22. URL DIRETA DE EDIÇÃO

==================================================

&nbsp;

Se alguém tentar:

&nbsp;

/pedidos-venda/novo?edit=<pedido excluído>

&nbsp;

e Node retornar:

&nbsp;

410 ORDER_DELETED

&nbsp;

mostrar mensagem amigável:

&nbsp;

"Este pedido foi excluído do ERP e não pode mais ser editado."

&nbsp;

Não hidratar Wizard.

&nbsp;

Não reutilizar dados persistidos antigos do Zustand.

&nbsp;

==================================================

23. ESTADO DE INDISPONIBILIDADE NO FRONTEND

==================================================

&nbsp;

Implementar explicitamente tratamento para:

&nbsp;

erpStatusQ.isError

&nbsp;

Nesse caso mostrar:

&nbsp;

ERP: INDISPONÍVEL

&nbsp;

Não montar objetos:

&nbsp;

deleted=true

&nbsp;

como fallback.

&nbsp;

Se houver dado anterior válido do React Query durante refetch, pode manter

esse dado até nova resposta.

&nbsp;

Mas erro sem dado válido:

&nbsp;

INDISPONÍVEL.

&nbsp;

==================================================

24. NÃO ALTERAR order_drafts.status

==================================================

&nbsp;

Pedido excluído pode continuar:

&nbsp;

status = "sent"

&nbsp;

no Supabase.

&nbsp;

A UI pode mostrar simultaneamente:

&nbsp;

Enviado ao ERP

ERP: EXCLUÍDO

&nbsp;

Isso é correto.

&nbsp;

O primeiro representa histórico do app.

O segundo representa estado atual do ERP.

&nbsp;

==================================================

25. NÃO CRIAR MIGRATION NESTA SPRINT

==================================================

&nbsp;

Não adicionar:

&nbsp;

erpSyncState

deletedAt

erp_deleted

etc.

&nbsp;

ao Supabase neste momento.

&nbsp;

O estado será derivado pelo batch-status.

&nbsp;

Persistência pode ser avaliada posteriormente se precisarmos de:

&nbsp;

- auditoria temporal;

- notificações;

- filtro persistente;

- relatórios.

&nbsp;

==================================================

26. ENTREGAS E RECOLHAS

==================================================

&nbsp;

Não alterar nesta Sprint se as consultas operacionais já excluem:

&nbsp;

DELETED != 0

&nbsp;

Validar apenas que não houve regressão.

&nbsp;

Pedido excluído não deve reaparecer como operação ativa.

&nbsp;

==================================================

27. ORDEM DE DEPLOY SEGURA

==================================================

&nbsp;

Como estamos mudando contrato entre frontend e Node:

&nbsp;

1. implementar backend com suporte simultâneo:

   - orderNumbers novo;

   - orderIds legado com semântica de ID interno.

&nbsp;

2. atualizar/reiniciar Node.

&nbsp;

3. publicar frontend usando orderNumbers.

&nbsp;

4. testar.

&nbsp;

Não criar janela em que:

&nbsp;

orderIds interno

&nbsp;

seja interpretado como:

&nbsp;

N_PEDIDO.

&nbsp;

==================================================

28. TESTE — ATIVO

==================================================

&nbsp;

Pedido ativo:

&nbsp;

N_PEDIDO = __________

&nbsp;

Esperado:

&nbsp;

exists = true

deleted = false

status real

canEdit conforme whitelist.

&nbsp;

==================================================

29. TESTE — EXCLUÍDO LÓGICO

==================================================

&nbsp;

Pedido com DELETED ativo:

&nbsp;

Esperado:

&nbsp;

exists = true

deleted = true

statusDescription = "EXCLUÍDO"

canEdit = false

&nbsp;

==================================================

30. TESTE — EXCLUÍDO FÍSICO

==================================================

&nbsp;

Pedido existente no order_drafts mas removido fisicamente do ERP:

&nbsp;

Esperado no batch por orderNumbers:

&nbsp;

exists = false

deleted = true

statusDescription = "EXCLUÍDO"

canEdit = false

&nbsp;

==================================================

31. TESTE — BATCH MISTO

==================================================

&nbsp;

Solicitar:

&nbsp;

ativo + excluído

&nbsp;

Quantidade solicitada:

2

&nbsp;

Quantidade retornada:

2

&nbsp;

Nenhum N_PEDIDO omitido.

&nbsp;

==================================================

32. TESTE CRÍTICO — CONTRATO LEGADO

==================================================

&nbsp;

Enquanto orderIds existir:

&nbsp;

enviar um ID_ORDENS_VENDA real via:

&nbsp;

?orderIds=...

&nbsp;

Confirmar que ele NÃO é interpretado como N_PEDIDO.

&nbsp;

Esse teste é obrigatório antes da publicação.

&nbsp;

==================================================

33. TESTE CRÍTICO — NODE/FIREBIRD OFFLINE

==================================================

&nbsp;

Simular indisponibilidade.

&nbsp;

Esperado:

&nbsp;

ERP: INDISPONÍVEL

&nbsp;

Nunca:

&nbsp;

ERP: EXCLUÍDO

&nbsp;

==================================================

34. REGRESSÃO

==================================================

&nbsp;

Validar:

&nbsp;

CREATE: PASS

EDIT pedido ativo: PASS

Itens: PASS

Equipamentos: PASS

Cobertura: PASS

Entrega: PASS

Pagamento/ID_FPGTO: PASS

Salvamento EDIT: PASS

&nbsp;

==================================================

NODE ALTERADO

==================================================

&nbsp;

NODE ALTERADO: SIM

&nbsp;

Arquivos esperados:

&nbsp;

erp-api/src/modules/orders/orders.repository.js

erp-api/src/modules/orders/orders.service.js

erp-api/src/modules/orders/orders.controller.js

&nbsp;

Frontend esperado:

&nbsp;

src/lib/erp-orders.functions.ts

src/routes/_authenticated.pedidos-venda.index.tsx

src/routes/_authenticated.pedidos-venda.$draftId.tsx

&nbsp;

Depois de atualizar Node:

&nbsp;

REINICIAR.

&nbsp;

Não executar npm install se dependências não forem alteradas.

&nbsp;

==================================================

RELATÓRIO FINAL OBRIGATÓRIO

==================================================

&nbsp;

SPRINT 8.9.40

&nbsp;

IDENTIFICADORES

&nbsp;

Novo batch usa N_PEDIDO:

PASS/FAIL

&nbsp;

Frontend envia erp_order_number:

PASS/FAIL

&nbsp;

orderIds legado continua significando ID interno:

PASS/FAIL

&nbsp;

Nenhum ID interno é interpretado como N_PEDIDO:

PASS/FAIL

&nbsp;

&nbsp;

ATIVO

&nbsp;

N_PEDIDO:

____

&nbsp;

exists:

____

&nbsp;

deleted:

____

&nbsp;

status:

____

&nbsp;

canEdit:

____

&nbsp;

&nbsp;

EXCLUÍDO LÓGICO

&nbsp;

N_PEDIDO:

____

&nbsp;

exists:

TRUE/FALSE

&nbsp;

deleted:

TRUE/FALSE

&nbsp;

status:

____

&nbsp;

canEdit:

____

&nbsp;

&nbsp;

EXCLUÍDO FÍSICO

&nbsp;

N_PEDIDO:

____

&nbsp;

exists:

TRUE/FALSE

&nbsp;

deleted:

TRUE/FALSE

&nbsp;

status:

____

&nbsp;

canEdit:

____

&nbsp;

&nbsp;

BATCH MISTO

&nbsp;

Solicitados:

____

&nbsp;

Retornados:

____

&nbsp;

Nenhum omitido:

PASS/FAIL

&nbsp;

&nbsp;

INDISPONIBILIDADE

&nbsp;

Node/Firebird offline:

ERP INDISPONÍVEL / __________

&nbsp;

Virou EXCLUÍDO incorretamente:

SIM/NÃO

&nbsp;

&nbsp;

GET/PUT

&nbsp;

GET lógico excluído → 410:

PASS/FAIL

&nbsp;

PUT lógico excluído → 410:

PASS/FAIL

&nbsp;

URL direta bloqueada:

PASS/FAIL

&nbsp;

&nbsp;

LISTA

&nbsp;

Ativo mostra status:

PASS/FAIL

&nbsp;

Excluído mostra EXCLUÍDO:

PASS/FAIL

&nbsp;

Erro mostra INDISPONÍVEL:

PASS/FAIL

&nbsp;

&nbsp;

REGRESSÃO

&nbsp;

CREATE:

PASS/FAIL

&nbsp;

EDIT ativo:

PASS/FAIL

&nbsp;

Itens/equipamentos:

PASS/FAIL

&nbsp;

Cobertura:

PASS/FAIL

&nbsp;

Pagamento:

PASS/FAIL

&nbsp;

Salvamento EDIT:

PASS/FAIL

&nbsp;

&nbsp;

SUPABASE

&nbsp;

order_drafts.status permaneceu intacto:

PASS/FAIL

&nbsp;

Nenhuma migration criada:

PASS/FAIL

&nbsp;

&nbsp;

NODE ALTERADO:

SIM

&nbsp;

NODE PRECISA REINICIAR:

SIM