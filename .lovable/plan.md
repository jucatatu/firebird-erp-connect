# SPRINT UI — CARDS COMPACTOS DE PEDIDOS

Refinar a apresentação visual dos cards da listagem de pedidos, tornando-os mais compactos e fáceis de ler, com destaque para produtos e equipamentos.

## Alterações

### 1. Backend & Regras de Negócio
- **Nenhuma alteração.** Lógica de pedidos, status ERP e Supabase permanecem idênticos.

### 2. Utilitários (Frontend)
- **`src/lib/order-summary.ts`**:
    - Criar `getItemList` e `getEquipmentList` que retornam arrays formatados em vez de strings concatenadas.
    - Formatar como `QUANTIDADE + DESCRIÇÃO` (ex: `10L CHOPP PILSEN`, `1x CHOPEIRA`).
    - Simplificar descrições de equipamentos (ex: remover "30L/H").

### 3. Interface (Frontend)
- **`src/routes/_authenticated.pedidos-venda.index.tsx`**:
    - Refatorar o card mobile (`ul` na linha 283):
        - **Destaque do Cliente**: Manter como título principal.
        - **Identificadores**: Linha compacta com `ERP` e `PED`.
        - **Status**: Manter Badges de Status ERP e Sincronização.
        - **Empresa/Data**: Linha única compacta.
        - **Blocos de Itens**: Criar dois blocos lado a lado (ou empilhados se necessário) para Produtos e Equipamentos.
        - **Logística**: Rodapé simplificado.
    - Ajustar paddings e gaps para reduzir a altura total do card.
    - Garantir que um equipamento ocupe exatamente uma linha dentro do bloco.

## Critérios de Aceite
- Quantidade SEMPRE antes da descrição.
- Um equipamento por linha.
- Layout responsivo (blocos lado a lado ou empilhados).
- Sem alteração em rotas, filtros ou salvamento.
