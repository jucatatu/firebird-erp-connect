# Plano de Implementação: SPRINT ORDERS UX

Este plano visa implementar melhorias de UX no módulo de Pedidos, incluindo a exibição do vendedor na listagem e o agrupamento de produtos em cards por categoria no Wizard.

## 1. Vendedor na Listagem de Pedidos

- **Resolução de Nomes:** Buscar todos os vendedores ERP (`searchErpSellers` com `limit=100`) uma única vez na página de listagem para evitar o problema N+1.
- **Mapeamento:** Utilizar `payload.sellerId` de cada rascunho para encontrar o nome correspondente no mapa de vendedores.
- **Visual Desktop:** Adicionar o nome do vendedor na célula "Empresa", ex: `GROTT • MARCEL`.
- **Visual Mobile:** Adicionar o vendedor de forma compacta nos cards, ex: `GROTT • MARCEL • 18/08/2026`.

## 2. Catálogo em Cards por Categoria (Wizard)

- **Remoção de Busca:** Eliminar o campo de filtragem de produtos da etapa "Produtos".
- **Classificador de Produtos:** Implementar lógica em `src/utils/order-product-group.ts` baseada em prioridades:
  1. GROWLER
  2. GARRAFA
  3. CHOPP
  4. OUTROS (fallback)
- **Componente de Acordeão:** Reorganizar a lista de produtos em containers visuais (Cards principais) por categoria.
  - **CHOPP:** Inicia expandido.
  - **GROWLER/GARRAFA/OUTROS:** Iniciam recolhidos.
- **Preservação de Estado:** Garantir que o agrupamento visual não afete a seleção, quantidades ou preços dos produtos já adicionados.

## 3. Garantia de Qualidade

- **Testes Unitários:** Criar `src/utils/__tests__/order-product-group.test.ts` validando a lógica de classificação e prioridades.
- **Regressão:** Executar `vitest` para garantir que não houve regressão em contratos de API ou permissões.
- **Build & Typecheck:** Validar integridade final do código.

## Detalhes Técnicos

- Alterações concentradas em `src/routes/_authenticated.pedidos-venda.index.tsx`, `src/routes/_authenticated.pedidos-venda.novo.tsx` e helpers.
- Nenhuma alteração no backend Node, Supabase ou regras de negócio do Firebird.
- Uso de `useQuery` para carregar vendedores e produtos de forma eficiente.
