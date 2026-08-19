# PLANO — HOTFIX ORDERS UX.1 — CARDS-PAI VISUAIS DAS CATEGORIAS

Realizar refinamento visual na etapa de Produtos do Wizard de Novo Pedido, transformando os itens do accordion em cards independentes com espaçamento entre eles.

## Alterações Propostas

### Frontend (`src/routes/_authenticated.pedidos-venda.novo.tsx`)

- **Estrutura de Container**:
    - Remover a classe `divide-y` da `div` que envolve o Accordion.
    - Manter o título "1. Produtos" no Card superior ou ajustar para que as categorias pareçam externas se necessário.
- **Accordion e Itens**:
    - Manter `Accordion type="multiple" defaultValue={["CHOPP"]}`.
    - Aplicar classes de Card em cada `AccordionItem`:
        - `rounded-xl`, `border`, `bg-card`, `shadow-sm`, `overflow-hidden`.
        - Adicionar margem inferior ou usar `space-y-3` no container para separar os cards.
        - Remover `border-b` que causa o efeito de lista.
- **Cabeçalho (AccordionTrigger)**:
    - Ajustar padding e estados de hover para manter a aparência de card.
    - Preservar contadores e labels.
- **Conteúdo (AccordionContent)**:
    - Garantir que os `ProductCard` fiquem visualmente contidos dentro do card-pai.
    - Usar padding interno e opcionalmente um background sutil (`bg-muted/5`).

## Regras de Preservação

- **Zero Alteração Funcional**:
    - Classificação de produtos (CHOPP, GROWLER, GARRAFAS, OUTROS).
    - Lógica de carrinho (adição, remoção, preços).
    - Lógica de vendedores e listagem.
    - Lógica de horários e geolocalização.
- **Zero Alteração Backend**:
    - Node, Firebird e Supabase permanecem intocados.

## Detalhes Técnicos

- Utilização de classes Tailwind: `space-y-3` no container, `rounded-xl border bg-card shadow-sm mb-3` nos itens.
- O Accordion continuará permitindo múltiplos grupos abertos.
