# Plan - Map Recovery

Recuperar o Mapa Operacional como tela principal (home) do ERP, adaptando a implementação histórica (commit 5740ecf4) aos componentes e hooks atuais, sem regredir regras de segurança ou UX do catálogo.

## User Review Required

> [!IMPORTANT]
> A home `/` passará a ser o Mapa. O redirecionamento para `/pedidos-venda` será removido.
> O layout "fullBleed" (sem margens) será aplicado apenas na home para maximizar a área do mapa.

## Proposed Changes

### 1. Rota de Autenticação (`src/routes/_authenticated.tsx`)
- Detectar o pathname atual.
- Aplicar `variant="fullBleed"` no `AppShell` apenas quando o usuário estiver na home (`/`).

### 2. Home Page (`src/routes/_authenticated.index.tsx`)
- Remover o `redirect` para `/pedidos-venda`.
- Implementar o componente `MapHome` baseado na referência histórica.
- **Diferenciais da adaptação:**
    - Usar `useMapOrders`, `useOperationStates` e `useGeocodeOrders` de `src/hooks/use-erp.ts` e `use-operations.ts`.
    - Integrar `MapView` atual preservando labels de número comercial e horário.
    - Utilizar `OrderDetailSheet` para ações operacionais.
    - Manter filtros de Empresa (Graal/Grott) e busca local.

### 3. Redirecionamento de Legado (`src/routes/_authenticated.operations.tsx`)
- Garantir que `/operations` redirecione para `/`.

## Technical Details
- **Geocoding:** Preservar a lógica de auto-geocoding com proteção de `Set` para evitar loops de requisição.
- **Responsividade:** Layout desktop com lista lateral (384px) e mapa principal; Layout mobile com alternância entre mapa e lista via botões flutuantes.
- **Filtros:** Mapear `filterOfStatus` para garantir que os contadores e a visibilidade dos marcadores estejam sincronizados.
- **Estado Operacional:** Vincular pedidos do ERP aos estados do banco operacional via `erp_order_id`.

## Validation Plan
- [ ] Acessar `/` e verificar se o mapa carrega.
- [ ] Verificar se `/pedidos-venda` continua funcionando independentemente.
- [ ] Testar troca de empresa (Todas/Graal/Grott) no mapa.
- [ ] Validar que clicar em um marcador abre o `OrderDetailSheet`.
- [ ] Testar busca por número de pedido e nome de cliente.
- [ ] Validar comportamento mobile (alternância mapa/lista).
- [ ] Executar `tsgo` e `build` para garantir integridade.
