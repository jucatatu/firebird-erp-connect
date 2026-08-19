# Plan: HOTFIX CATALOG UX.1.3 — CORRIGIR CONFLITO FALSO NO REORDER

Implementar um fluxo de preflight select no reorder do catálogo para eliminar conflitos causados por versões de cache desatualizadas, mantendo a integridade transacional.

## Technical Details

### 1. Hook `useReorderCatalogItems` (`src/hooks/use-catalog.ts`)
- Mudar `mutationFn` para não receber `expectedVersions`.
- Implementar `SELECT` fresco de `order_catalog_settings` filtrado por `itemType`.
- Validar se o conjunto de IDs retornado pelo `SELECT` é idêntico ao `orderedIds`.
- Lançar `catalog_reorder_snapshot_conflict` se houver divergência.
- Mapear as versões frescas para os IDs solicitados.
- Chamar a RPC `admin_reorder_catalog_items` com essas versões.

### 2. UI da Página de Catálogo (`src/routes/_authenticated.settings.catalogo.tsx`)
- Remover o envio de `expectedVersions` nas chamadas de `mutateAsync` em `ProductsTab` e `EquipmentTab`.

### 3. Formatação de Erros (`src/utils/error-formatter.ts`)
- Atualizar `formatSupabaseError` para incluir `detail` e `hint` nos erros de catálogo.
- Mudar mensagem de `catalog_reorder_conflict` para ser mais genérica e informativa.
- Adicionar tratamento para `catalog_reorder_snapshot_conflict`.

### 4. Testes
- Adicionar cenários em `src/hooks/__tests__/catalog-error-exposure.test.tsx` (ou novo arquivo) cobrindo:
  - Cache stale (sucesso via preflight).
  - Conflito de snapshot (IDs diferentes).
  - Conflito real na RPC (versão mudou no microssegundo entre select e RPC).

## User Review Required

> [!IMPORTANT]
> A RPC `admin_reorder_catalog_items` no banco de dados NÃO será alterada. A lógica de proteção continua lá, apenas garantimos que o frontend a use com dados frescos.

- **Fluxo de Erro**: Se o catálogo mudar enquanto você arrasta os itens, o sistema agora dirá especificamente que a lista mudou e pedirá para atualizar, em vez de mostrar um erro técnico genérico.
