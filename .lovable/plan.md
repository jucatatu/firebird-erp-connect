# Plano: Sprint Catalog UX — Ordenação Visual por Drag-and-Drop

Melhorar a administração do catálogo de itens (Produtos e Equipamentos) através de uma interface de drag-and-drop mobile-first, permitindo a reordenação visual atômica.

## Alterações Propostas

### Backend (Supabase / ERP API)
- **RPC `admin_reorder_catalog_items`**: Implementar função transacional no Postgres para atualizar o `sort_order` de múltiplos itens de uma só vez (já criada em migration, validada).
- **ERP API**: Zero alterações no Node/Firebird (regra mantida).

### Frontend
- **Bibliotecas**: Adicionar `@dnd-kit/core`, `@dnd-kit/sortable` e `@dnd-kit/utilities` para suporte robusto a drag em mobile e desktop.
- **Utilitários**:
    - `src/utils/catalog-reorder-utils.ts`: Helper para manipulação de arrays (moveItem) e cálculo de sort_order (múltiplos de 10).
- **Hooks**:
    - `useReorderCatalog`: Novo hook em `src/hooks/use-catalog.ts` para chamar a RPC de reordenação.
- **Componentes**:
    - `src/components/settings/catalog-reorder-list.tsx`: Componente de lista arrastável com handle, suporte a categorias e modo de edição simplificado.
- **Páginas**:
    - `src/routes/_authenticated.settings.catalogo.tsx`: 
        - Adicionar botões "Ordenar", "Salvar ordem" e "Cancelar".
        - Implementar modo de ordenação com estado local.
        - Integrar categorias para Produtos (reutilizando `classifyOrderProduct`).

## Detalhes Técnicos
- **Estado Local**: Toda movimentação durante o drag altera apenas um estado local (`localOrder`).
- **Persistência Atômica**: O banco é atualizado apenas no clique em "Salvar", enviando a lista completa de IDs na nova ordem.
- **Categorias**: Produtos são ordenados apenas dentro de seus grupos (CHOPP, GROWLER, etc.). Não é permitido arrastar entre grupos.
- **Segurança**: A RPC valida permissão de `admin` e integridade dos itens.
- **Mobile**: Handle dedicado (☰) para evitar conflitos com scroll lateral/vertical.

## Invariantes
- **sort_order**: Sempre múltiplos de 10 (10, 20, 30...).
- **Concorrência**: Incremento de `version` no banco para cada item atualizado.
- **Novo Item**: Atribuição automática de `max(sort_order) + 10` no cadastro individual.
- **Novo Pedido**: Garantir que a listagem de produtos respeite o `sort_order` configurado.
