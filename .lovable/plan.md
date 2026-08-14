# Plano de Ação - Sprint 8.9.39

Este plano visa corrigir o problema de cobertura de equipamentos (barris/chopeiras) que ocorre exclusivamente no modo de edição de pedidos do ERP. O objetivo é garantir que os equipamentos carregados do ERP sejam corretamente normalizados com metadados do catálogo (capacidade, tipo, linhas) e associados aos produtos de chopp correspondentes, permitindo que o cálculo de cobertura reflita a realidade física do pedido.

## Alterações Propostas

### 1. Store de Pedidos (`src/hooks/use-order-form.ts`)
- Ajustar a função `editErpOrder` para registrar logs de auditoria (`ERP raw equipments`).
- Manter a hidratação base dos equipamentos, mas sem tentar normalizar metadados complexos aqui para manter a store como um repositório puro de dados.

### 2. Wizard de Pedidos (`src/routes/_authenticated.pedidos-venda.novo.tsx`)
- **Auditoria Temporária:** Adicionar logs detalhados no fluxo de hidratação (`hydrate`) para inspecionar os objetos `items` e `equipments` vindos do ERP.
- **Normalização de Equipamentos:** Implementar um `useEffect` especializado para o modo edição que:
  1. Identifica equipamentos sem metadados operacionais (`role`, `capacityLiters`, `tapLines`).
  2. Busca esses dados no catálogo (`equipmentTypesQ.data`).
  3. **Reconstrução de `assignedProductId`:**
     - Prioridade 1: Usar o `assignedProductId` se já existir no snapshot operacional.
     - Prioridade 2: Se houver apenas um produto de chopp no pedido, associar automaticamente todos os barris (KEG) a ele.
     - Prioridade 3: Se houver múltiplos, manter nulo e exigir revisão manual (sem inventar associações).
- **Gate de Renderização:** Garantir que a cobertura seja calculada e validada apenas após a conclusão desta normalização, evitando o estado "0/10 L" momentâneo.

### 3. Lógica de Cobertura (`src/routes/_authenticated.pedidos-venda.novo.tsx`)
- Validar se a função `getProductCoverage` está reagindo corretamente às mudanças nos equipamentos (reatividade do Zustand).
- Garantir que a cobertura não use chopeiras (TAP) para somar litros, apenas barris (KEG).

## Detalhes Técnicos
- O catálogo de equipamentos (`useErpEquipmentTypes`) será a fonte da verdade para preencher `capacityLiters` e `role`.
- A associação automática de barris em pedidos com um único chopp resolve o cenário mais comum de erro relatado.
- Nenhuma alteração será feita no backend (Node) ou no fluxo de criação de novos pedidos (regressão zero).

## Critérios de Aceite
- Ao abrir o pedido de teste (CHOPP PILSEN 10L + BARRIL 10L), a cobertura deve exibir "10 / 10 L COBERTO" imediatamente.
- O botão "Próximo" e os swipes devem estar habilitados se a cobertura estiver completa.
- Alterações de quantidade de produtos ou remoção de equipamentos devem refletir instantaneamente na cobertura e nos guards de navegação.
- Novos pedidos devem continuar funcionando conforme o comportamento atual aprovado.
