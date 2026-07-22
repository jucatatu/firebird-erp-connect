
# Fase 3D — Fluxo operacional completo no mapa

Entrega uma camada de **operação local** sobre os pedidos lidos do ERP, mantendo o mapa como centro. Nada é enviado ao Firebird nem ao Google. Toda persistência é no Lovable Cloud com RLS.

## 1. Modelo de dados (Lovable Cloud)

Migração única, sempre com `GRANT` + `RLS`:

- **`operation_states`** — 1 linha por (`operation_date`, `erp_order_id`)
  - `id uuid pk`, `erp_order_id bigint`, `erp_order_number int`, `company_id smallint`
  - `operation_date date` (ERP), `operational_date date` (reagendamento local)
  - `operational_status` enum: `pending | in_progress | delivered | collected | customer_will_call | not_found | rescheduled`
  - `sequence int` (ordem manual), `reschedule_reason text`
  - `snapshot jsonb` (nome do cliente, endereço, telefone — para trabalhar offline)
  - `created_by`, `updated_by`, timestamps
  - UNIQUE (`operation_date`, `erp_order_id`)

- **`operation_events`** — timeline append-only
  - `id`, `operation_state_id fk`, `event_type` enum, `description text`
  - `metadata jsonb`, `actor_id`, `origin` enum (`local | erp`), `created_at`
  - `event_type`: `loaded | started | note_added | rescheduled | customer_will_call | delivered | collected | not_found | corrected`

- **`operation_notes`** — notas operacionais (separadas da OBS do ERP)
  - `id`, `operation_state_id fk`, `body text`, `author_id`, `created_at`

Enums novos: `operational_status`, `operation_event_type`, `operation_event_origin`.

Triggers:
- `set_updated_at` em `operation_states`.
- Log automático em `operation_events` a cada `INSERT`/mudança de status.

### RLS
- `operation_states` / `operation_events` / `operation_notes`:
  - `authenticated` pode SELECT/INSERT/UPDATE.
  - UPDATE bloqueado em `operation_events` (append-only) exceto `admin` (correção → novo evento `corrected`, nunca DELETE).
  - Escopo por empresa: usuário só vê linhas de empresas às quais tem acesso. Como ainda não há tabela `user_companies`, nesta fase a política é **por `created_by = auth.uid()` OR `has_role(admin/aprovador)`**, e deixa comentário SQL indicando o ponto de extensão para multi-tenant futuro.

## 2. Camada de serviço (frontend)

`src/lib/operations/OrderOperationService.ts` — interface pura:

```ts
interface OrderOperationService {
  startOrder(input): Promise<OperationState>
  markDelivered(input): Promise<OperationState>
  markCollected(input): Promise<OperationState>
  markCustomerWillCall(input): Promise<OperationState>
  markNotFound(input): Promise<OperationState>
  reschedule(input: { newDate, reason, note? }): Promise<OperationState>
  addNote(input: { body }): Promise<OperationNote>
  reorder(input: { operationDate, orderedIds }): Promise<void>
}
```

Implementação atual: `LocalOrderOperationService` (Supabase). Placeholder `ErpOrderOperationService` documentado, **não implementado**. Componentes/hook `useOrderOperations` só conhecem a interface — nada de HTTP inline.

## 3. Hooks

- `useOperationStates(date, companyId)` — join dos pedidos do ERP com estados locais por `(date, erp_order_id)`.
- `useOperationEvents(operationStateId)`.
- `useOperationMutations()` — todas as ações via `OrderOperationService`, invalida queries.

## 4. UI

### Mapa (`/`)
- Cor do marcador reflete **status operacional** (pending, in_progress, delivered, collected, customer_will_call, not_found, rescheduled) — geocoding continua com badges próprios.
- Após ação: fecha sheet, atualiza marcador/contadores, **auto-seleciona o próximo `pending`**, mantém data/filtros. Sem reload.

### Painel de detalhe (drawer desktop / bottom sheet mobile)
- Cabeçalho: PED-XXXXXX, cliente, empresa, badge status ERP + badge status operacional + badge "Reagendado localmente" quando aplicável.
- Blocos: Endereço + telefone (ligar / abrir Maps), Equipamentos, Itens, **Observação do ERP** (read-only), **Observações da operação** (lista + input).
- **Ações operacionais** (botões grandes): Iniciar / Entregar / Recolher / Cliente irá avisar / Não localizado / Reagendar / Adicionar observação.
- Confirmação (`AlertDialog`) para ações críticas com resumo (cliente, endereço, itens, obs).
- Timeline abaixo (origem `local` marcada).

### Filtros
Chips primários operacionais: Todos, Pendentes, Em atendimento, Entregues, Recolhidos, Cliente irá avisar, Não localizados, Reagendados. Filtros secundários (popover): empresa, cidade, bairro, status ERP, status operacional. Aplicados igualmente a mapa e lista.

### Lista do dia
Toggle "Mapa / Lista" já existente. Card com: número, cliente, empresa, endereço, ERP status, status operacional, badge de localização, sequência, ícone de nota, equipamentos. Ordenar por: manual, cliente, cidade, bairro, status, número. Drag-and-drop (dnd-kit) na ordem manual salvando `sequence`.

### Contadores
Header do mapa mostra 2 grupos separados:
- **Operacional**: Total, Pendentes, Em atendimento, Entregues, Recolhidos, Reagendados, Não localizados.
- **Geocoding**: Mapeados, Pendentes de localização, Não localizados geograficamente.

### Offline
- `useNetworkStatus` (`navigator.onLine`). Indicador na topbar.
- Fila em `localStorage` (`pending-operations`): mutations offline entram na fila com flag `awaiting_sync`; timeline mostra chip "aguardando sincronização".
- Ao voltar online, drena a fila para Supabase.

## 5. Mobile / Desktop
- Mobile: mapa fullscreen, chips topo, bottom nav, bottom sheet, ação principal fixa, targets ≥ 44px.
- Desktop: mapa central, sidebar lista recolhível, drawer detalhe, atalhos (`j/k` navegar, `Enter` abrir, `d` entregar, `r` recolher).

## 6. Segurança
- `actor_id = auth.uid()` em todos os inserts (default DB).
- `operation_events` sem UPDATE/DELETE para não-admin (RLS).
- Correção admin = novo evento `corrected` com `metadata.previousEventId`.

## 7. Testes
Vitest para: reducers de filtro/contadores, `LocalOrderOperationService` (mock supabase), fila offline. Smoke via Playwright: iniciar → entregar → auto-select próximo; drag-and-drop persistindo após reload.

## 8. Invariantes verificadas
- Nenhuma chamada nova ao `erp-api` além de `GET /api/v1/map/orders`.
- Zero `POST /orders`, zero chamada ao Google.
- `erp-api/` intocado.

## 9. Arquivos principais

Novos:
- `supabase/migrations/xxxx_fase3d_operations.sql`
- `src/lib/operations/types.ts`
- `src/lib/operations/OrderOperationService.ts` (interface)
- `src/lib/operations/LocalOrderOperationService.ts`
- `src/lib/operations/ErpOrderOperationService.ts` (stub documentado)
- `src/lib/operations/offline-queue.ts`
- `src/hooks/use-operations.ts`
- `src/hooks/use-network-status.ts`
- `src/components/operation/order-detail-sheet.tsx`
- `src/components/operation/operation-actions.tsx`
- `src/components/operation/operation-timeline.tsx`
- `src/components/operation/reschedule-dialog.tsx`
- `src/components/operation/note-composer.tsx`
- `src/components/operation/operational-filters.tsx`
- `src/components/operation/operational-counters.tsx`
- `src/components/operation/orders-list-view.tsx` (com dnd-kit)

Editados:
- `src/routes/_authenticated.index.tsx` — orquestra mapa/lista/detalhe/filtros.
- `src/components/map-view.tsx` — cor por status operacional.
- `src/lib/map-layers.ts` — chips operacionais.
- `src/components/app-topbar.tsx` — indicador offline.

## 10. Entrega
Ao final: lista de migrações + policies, screenshots mobile/desktop do fluxo entrega+recolha, verificação `git diff erp-api/` vazio, e nota de riscos para sincronização futura com Node (mapeamento `operational_status` → ação ERP, resolução de conflitos, idempotência do envio).

---

**Confirma este plano?** Escopo grande; se algo tiver que ficar para uma sub-fase (ex.: drag-and-drop ou offline), me avise antes de eu começar.
