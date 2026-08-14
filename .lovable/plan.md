# SPRINT 8.9.40 — IDENTIFICAR PEDIDOS EXCLUÍDOS DO ERP E BLOQUEAR EDIÇÃO

## Objetivos
O objetivo desta Sprint é garantir que pedidos excluídos no ERP (física ou logicamente via coluna `DELETED`) sejam identificados corretamente pelo aplicativo. Eles devem permanecer no histórico por auditoria, mas com um estado visual "ERP: EXCLUÍDO" e bloqueio total de edição/alteração.

## Modificações

### 1. Backend (Node.js ERP API)

- **orders.repository.js**:
  - Atualizar `findStatusByNumbers` para incluir a coluna `ov.DELETED` e remover qualquer filtro que oculte registros deletados.
  - O SELECT deve retornar `ID_ORDENS_VENDA`, `N_PEDIDO`, `ID_STATUS`, `DELETED` e `STATUS_DESCRICAO`.
- **orders.service.js**:
  - **getBatchStatus**: Refatorar para garantir que CADA `orderNumber` solicitado receba uma resposta.
    - Se o registro existe e `DELETED` é 0/null: retorna status normal.
    - Se o registro existe mas `DELETED` != 0: retorna `deleted: true`, `statusDescription: "EXCLUÍDO"`, `canEdit: false`.
    - Se o registro NÃO existe no Firebird (exclusão física): retorna `exists: false`, `deleted: true`, `statusDescription: "EXCLUÍDO"`, `canEdit: false`.
  - **getOrderDetail**: Adicionar check de `DELETED`. Se o pedido estiver deletado, retornar `410 Gone` com código `ORDER_DELETED`.
  - **updateOrder**: Adicionar check de `DELETED` antes de qualquer validação. Se deletado, bloquear com `410 Gone`.
- **orders.controller.js**:
  - Atualizar `getBatchStatus` para aceitar `orderNumbers` (preferencial) e `orderIds` (legado, mapeado internamente para `orderNumbers`).

### 2. Frontend (TanStack Start)

- **src/lib/erp-orders.functions.ts**:
  - Atualizar interface `ErpOrderStatus` para incluir `exists`, `deleted` e garantir `orderNumber`.
  - Atualizar `getErpOrdersStatus` para enviar `orderNumbers` na query string e receber a lista completa de status.
- **src/routes/_authenticated.pedidos-venda.index.tsx**:
  - Corrigir a extração de identificadores: usar `erp_order_number` em vez de `erp_order_id` para consultar o status ERP.
  - Atualizar `statusMap` para indexar por `orderNumber`.
  - Implementar badge visual para `ERP: EXCLUÍDO` com variante de erro/cinza.
- **src/routes/_authenticated.pedidos-venda.$draftId.tsx**:
  - Atualizar a exibição de status ERP.
  - Se `deleted === true`, mostrar aviso de pedido excluído e ocultar o botão "Editar pedido".
  - Refinar a lógica de `canEdit` para exigir `erpStatus.deleted === false`.

## Verificação Técnica

### Contrato Batch Status
```json
{
  "orderNumber": 8654,
  "exists": true,
  "deleted": true,
  "statusDescription": "EXCLUÍDO",
  "canEdit": false
}
```

### Regras de Segurança
- Somente marcar como excluído se o request for bem sucedido e o dado for explícito.
- Erros de rede/autenticação/500 no Node devem resultar em `ERP: INDISPONÍVEL`, nunca `EXCLUÍDO`.
- Proteção 410 no Node para `GET` e `PUT` de pedidos deletados.
