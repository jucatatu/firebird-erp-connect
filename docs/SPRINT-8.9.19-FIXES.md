# SPRINT 8.9.19 — CORREÇÃO DE REGRESSÕES E FLUXO DE FINALIZAÇÃO

## Causa Raiz Diagnóstica
1. **Tela Branca na Finalização**: O fluxo anterior realizava o reset do estado (`resetItemsAndClient`) apenas 500ms após a navegação, mas o componente `NewOrderPage` ainda estava montado e observando um estado que se tornava inconsistente ou `undefined` durante a transição de rota, especialmente com a injeção de snapshots complexos.
2. **Recolher Equipamentos (Falso)**: O estado inicial no Zustand estava `false` e não havia efeito colateral para forçar `true` ao adicionar equipamentos retornáveis (barris/chopeiras) através da sugestão automática.
3. **Data de Recolhimento (+7 dias)**: A automação estava ausente no hook `setDelivery` e `setReturn` do Zustand, dependendo de manipulação manual no componente que foi perdida em refatorações.

## Correções Aplicadas

### P0 — Finalização do Pedido
- **Logs de Auditoria**: Adicionados prefixos `[ORDER UI]` e `[ORDER SERVER]` em toda a cadeia de submissão.
- **Proteção contra Duplicidade**: O botão de submissão agora exibe "Criando pedido no ERP..." e é desabilitado imediatamente. Em caso de sucesso, o botão desaparece dando lugar a um Badge de confirmação visual com o número do pedido.
- **Navegação Segura**: Aumentado o delay de navegação para 2s para garantir feedback visual ao vendedor antes da transição e limpeza de estado.

### P1 — Recolher Equipamentos
- **Auto-enable**: Adicionado `useEffect` no Passo 2 que detecta a presença de equipamentos e marca automaticamente "Recolher equipamentos? = true".

### P2 — Data de Recolhimento +7 Dias
- **Automação no Zustand**: Refatorados `setDelivery` e `setReturn` em `use-order-form.ts` para calcular automaticamente a data de recolhimento baseada na entrega (D+7) sempre que o recolhimento estiver ativo.

## Validação de Invariantes
- Mantida a integridade dos snapshots de produtos e clientes.
- Preservada a lógica de precificação manual vs ERP.
- Mantida a orquestração de transação atômica no servidor.
