# Validação e correção da geocodificação (erp-api v1.4.x)

Escopo: apenas backend `erp-api/`. Frontend, Lovable Cloud, Firebird (escrita), operation_states e Google Maps do navegador ficam intocados.

## Objetivo

Provar, em isolamento, que:

```text
GET /map/orders  (pending)
       │
       ▼
POST /map/geocode  ──► Google Geocoding API
       │                     │
       │                     ▼
       │                Cache (mesma instância)
       ▼
GET /map/orders  (source=cache, lat/lng)
```

funciona ponta-a-ponta para o pedido #8433 (RUA OSVALDO MAES, 30, JARAGUÁ DO SUL/SC).

## Mudanças

### 1. Contrato do POST — identificação correta
- `POST /api/v1/map/geocode` continua recebendo `{ orderIds: number[], limit?: number }`.
- `orderIds` = **ID interno** (`orders[].id` do GET = `ID_ORDENS_VENDA`), não `orderNumber` (`N_PEDIDO`).
- Validador (`map.validator.js`): reforçar positivos, dedup, `limit` máx. 50.
- Documentar no README do módulo.

### 2. Endereço canônico compartilhado
- Confirmar (já é o caso) que POST e GET usam a mesma cadeia: `opsMapper.mapAddress(row)` → `normalizeAddress(fields)` → `computeCacheKey`.
- Extrair helper explícito `buildCanonicalAddress(mapAddress)` em `geocoding-normalize.js` para eliminar qualquer risco de divergência futura; `normalizeAddress` passa a delegar nele.
- Teste de invariante: mesma row Firebird → mesma `cacheKey` no GET e no POST.

### 3. Provider — falha explícita
Novo módulo `providers/index.js` com `pickProvider()` que aplica:

| NODE_ENV     | GEOCODING_PROVIDER=fake | google sem chave           |
|--------------|-------------------------|----------------------------|
| test         | permitido               | erro                       |
| development  | permitido (com WARN)    | erro                       |
| production   | **erro de startup**     | **erro de startup**        |

- Validação roda no boot (`app.js`) e também por request no POST, devolvendo `503 provider_not_configured` com `errorCode`.
- Endpoint autenticado `GET /api/v1/health/geocoding` expõe `{ provider, configured, cacheKind, pid }`. Nunca a chave.

### 4. Classificação de estados (source)
Corrigir `map.service.js#locationFromEntry`:

| entry.status | GET source          |
|--------------|---------------------|
| resolved     | `cache` (ou `provider` na resposta imediata do POST) |
| unresolved   | `unresolved`        |
| skipped      | `unresolved`        |
| pending      | `pending`           |
| error        | `error` (+ `errorCode`) — hoje vira `pending` |

Adicionar `location.errorCode` quando `source="error"`.

### 5. Provider Google — logging seguro
- `providers/google.provider.js`: nunca logar URL com `key=`. Redigir. Já não loga, reforçar via wrapper.
- Log estruturado por chamada: `status, resultsCount, placeId, locationType, hasCoordinates, matchedCountry/State/City, precision, errorCode, latencyMs`.
- Tratar timeout (AbortController) e erros de rede como `errorCode: "TIMEOUT" | "NETWORK_ERROR"` → `status=error`.
- Mapear `REQUEST_DENIED`, `OVER_QUERY_LIMIT`, `INVALID_REQUEST`, `UNKNOWN_ERROR` → `status=error` com respectivo `errorCode` (hoje só ZERO_RESULTS é tratado).

### 6. Resposta do POST
```json
{
  "success": true,
  "summary": { "requested": 1, "found": 1, "resolved": 1, "unresolved": 0, "errors": 0, "pending": 0 },
  "results": [{
    "orderId": 12345,
    "orderNumber": 8433,
    "status": "resolved",
    "source": "provider",
    "precision": "high",
    "locationType": "ROOFTOP",
    "errorCode": null,
    "addressAvailable": true
  }]
}
```
Coordenadas ficam apenas no cache; GET é a fonte oficial.

### 7. Cache — instância única + diagnóstico
- Mantém `memory` (não implementa SQLite agora). `geocoding-cache.js` já é singleton por processo — reforçar com asserção no boot.
- Novo `scripts/inspect-geocoding-cache.js <orderId> <date>`: consulta o Firebird, monta canônico, imprime `{ cacheKind, pid, canonical, cacheKey, status, hasCoordinates, errorCode, attempts, updatedAt }`.
- `README.md` do módulo: documentar exigência PM2 fork mode / 1 instância e que restart apaga cache.

### 8. Script test-geocode
`scripts/test-geocode.js <orderNumber> <date>` (atualizar o já existente):
1. GET inicial → localiza `id` interno correspondente ao `orderNumber` visível.
2. POST com esse `id` interno.
3. Imprime resposta do POST.
4. GET final.
5. Compara `source`, `latitude`, `longitude` antes/depois.
6. Sai com código ≠ 0 se não resolveu.

### 9. Testes (node:test + supertest)
Adicionar em `tests/geocoding.test.js` e `tests/map.http.test.js`:
- POST usa ID interno; dedup; limite.
- Pedido inexistente → `found=false`, `status="not_found"`.
- Endereço incompleto → `unresolved` com `errorCode="NOT_GEOCODABLE"`.
- Provider Google sem chave em prod → boot falha; em dev/test → warn.
- Google OK / ZERO_RESULTS / REQUEST_DENIED / timeout — via fake provider parametrizado.
- Cache: 2ª chamada não invoca provider.
- GET após POST → coordenadas presentes, `source="cache"`.
- `status=error` **não** vira `pending` no GET.
- Invariante: `cacheKey(GET) === cacheKey(POST)` para a mesma row.

Rodar `npm run check` e `npm test` até verde.

## Detalhes técnicos

Arquivos afetados em `erp-api/`:
- `src/config/env.js` — validação cruzada provider×chave×NODE_ENV.
- `src/app.js` — validação de boot; monta rota de diagnóstico.
- `src/modules/health/health.controller.js` + `.routes.js` — `GET /health/geocoding` autenticado.
- `src/modules/map/geocoding-normalize.js` — expõe `buildCanonicalAddress`.
- `src/modules/map/geocoding-cache.js` — expõe `kind`, asserção singleton.
- `src/modules/map/geocoding.service.js` — trata REQUEST_DENIED/OVER_QUERY_LIMIT/INVALID_REQUEST/UNKNOWN_ERROR/timeout/rede como `error`.
- `src/modules/map/map.service.js` — `locationFromEntry` propaga `error` e `errorCode`; contrato do POST enriquecido (`orderNumber`, `addressAvailable`, `source`).
- `src/modules/map/map.controller.js` — envelope `{ success, summary, results }`.
- `src/modules/map/map.validator.js` — dedup + `limit` máx.
- `src/modules/map/providers/index.js` — `pickProvider` centralizado.
- `src/modules/map/providers/google.provider.js` — AbortController, mapeamento completo de status, log seguro.
- `src/modules/map/providers/fake.provider.js` — cenários REQUEST_DENIED / TIMEOUT para testes.
- `scripts/test-geocode.js` — reescrito conforme §8.
- `scripts/inspect-geocoding-cache.js` — novo.
- `tests/*` — casos novos.
- `.env.example` + `README.md` — documentação.

Não alterado: cliente Firebird, `orders/*`, `operations/*`, `src/` (frontend).

## Entrega

Após implementação, executarei:
1. `npm run check` e `npm test` no `erp-api/`.
2. Rodarei `scripts/test-geocode.js 8433 2026-07-22` **contra o fake provider** dentro do sandbox (o Firebird real e o Google só existem no seu servidor) — isso valida contrato, fluxo, cache e classificação de estados.
3. Entregarei o payload esperado e as instruções exatas para você rodar contra Google + Firebird reais em produção, incluindo como ler `GET /health/geocoding` e o `inspect-geocoding-cache.js`.

Zero escrita no Firebird — o módulo só usa `executeQuery` de leitura em `map.repository.js` e `operations.repository.js`.
