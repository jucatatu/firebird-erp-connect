# ERP API v1.0.0

Backend oficial de integração com o ERP Firebird.
Esta é a **primeira fase (v1.0.0)**: apenas a fundação técnica e endpoints de health.

> ⚠️ Este projeto é uma aplicação **Node.js tradicional** (Express + `node-firebird`).
> Ele **não roda** em ambientes serverless/edge — precisa de um Node com acesso
> ao Firebird (VPS Linux, Windows Server, container, etc.).

---

## Objetivo

Prover uma API modular, segura e organizada para integração com o Firebird do ERP.
Nesta fase estão implementados:

- Estrutura de projeto modular (`modules/`, `shared/`, `middleware/`, `config/`)
- Configuração centralizada e validada com Zod
- Conexão parametrizada com Firebird (charset `WIN1252`)
- Middlewares globais: Helmet, CORS por allowlist, rate limit, request-id, logger, error handler
- Autenticação com `x-api-key` + HMAC SHA-256 + timestamp + nonce (anti-replay)
- Health check da API e do ERP
- Versionamento em `/api/v1`

---

## Requisitos

- Node.js **>= 18**
- Acesso de rede ao servidor Firebird
- Usuário Firebird **não-padrão** (SYSDBA/masterkey são bloqueados por configuração)

---

## Instalação

```bash
cd erp-api
npm install
```

> Antes do `npm install`, confirme que o registry oficial está configurado:
> ```bash
> npm config get registry
> # deve retornar: https://registry.npmjs.org/
> ```

---

## Configuração (`.env`)

Copie o exemplo e edite:

```bash
cp .env.example .env
```

Variáveis obrigatórias: `FIREBIRD_HOST`, `FIREBIRD_PORT`, `FIREBIRD_DATABASE`,
`FIREBIRD_USER`, `FIREBIRD_PASSWORD`.
Em **produção** também são obrigatórias: `API_KEY` (≥16 chars) e `HMAC_SECRET` (≥32 chars).

O arquivo `.env` **nunca** deve ser commitado (já está no `.gitignore`).

### Bypass de autenticação em desenvolvimento

`DEV_BYPASS_AUTH=true` só tem efeito quando:

1. `NODE_ENV !== "production"`, **e**
2. a requisição vem de `127.0.0.1` / `::1` (localhost).

Em produção o valor é sempre ignorado.

---

## Execução

### Desenvolvimento

```bash
npm run dev
```

### Produção

```bash
NODE_ENV=production npm start
```

### Checagem sintática

```bash
npm run check
```

---

## Endpoints (v1.0.0)

Prefixo: `/api/v1`

| Método | Rota                 | Auth       | Descrição                              |
|--------|----------------------|------------|----------------------------------------|
| GET    | `/api/v1/health`     | Público    | Status da API                          |
| GET    | `/api/v1/health/erp` | HMAC*      | Verifica conectividade real com o ERP  |

`*` Sujeito ao bypass local descrito acima.

### Exemplo: `GET /api/v1/health`

```bash
curl http://localhost:3052/api/v1/health
```

```json
{
  "success": true,
  "data": {
    "service": "erp-api",
    "status": "ok",
    "version": "1.0.0",
    "environment": "development",
    "timestamp": "2026-07-21T12:00:00.000Z"
  }
}
```

### Exemplo: `GET /api/v1/health/erp` (com HMAC)

```bash
API_KEY="sua-api-key"
HMAC_SECRET="seu-hmac-secret"
METHOD="GET"
PATH="/api/v1/health/erp"
TS=$(node -e "process.stdout.write(String(Date.now()))")
NONCE=$(node -e "process.stdout.write(require('crypto').randomBytes(16).toString('hex'))")
BODY_HASH=$(printf "" | openssl dgst -sha256 -hex | awk '{print $2}')
CANONICAL=$(printf "%s\n%s\n%s\n%s\n%s" "$METHOD" "$PATH" "$TS" "$NONCE" "$BODY_HASH")
SIG=$(printf "%s" "$CANONICAL" | openssl dgst -sha256 -hmac "$HMAC_SECRET" -hex | awk '{print $2}')

curl -s http://localhost:3052$PATH \
  -H "x-api-key: $API_KEY" \
  -H "x-timestamp: $TS" \
  -H "x-nonce: $NONCE" \
  -H "x-signature: $SIG"
```

Resposta em sucesso:

```json
{
  "success": true,
  "data": { "status": "ok", "database": "reachable", "timestamp": "..." }
}
```

Resposta quando o ERP está indisponível (`HTTP 503`):

```json
{
  "success": false,
  "error": {
    "code": "ERP_UNAVAILABLE",
    "message": "ERP temporariamente indisponível.",
    "retryable": true
  }
}
```

---

## Autenticação (HMAC)

Headers obrigatórios:

| Header        | Descrição                                         |
|---------------|---------------------------------------------------|
| `x-api-key`   | Chave pública da aplicação (constante-time check) |
| `x-timestamp` | Unix time em **milissegundos**; janela: ±5 min    |
| `x-nonce`     | String única (8–128 chars); guardada anti-replay  |
| `x-signature` | HMAC-SHA256 hex da string canônica                |

**String canônica** (uma linha por campo, `\n` como separador):

```
<METHOD_MAIUSCULO>
<PATH_COM_QUERYSTRING>
<TIMESTAMP>
<NONCE>
<SHA256_HEX_DO_BODY_OU_DE_STRING_VAZIA>
```

Regras precisas do protocolo (v1.0.0):

- `METHOD` em MAIÚSCULAS (`GET`, `POST`, ...).
- `PATH` é o `req.originalUrl` **incluindo a querystring** exatamente como
  recebida (ex.: `/api/v1/health/erp?debug=1`). Para requisições sem query,
  é apenas o caminho (ex.: `/api/v1/health/erp`). O prefixo `/api/v1` faz parte
  do path assinado.
- `TIMESTAMP` em Unix time **milissegundos**; janela aceita: ±5 min do relógio do servidor.
- `NONCE`: string opaca de 8–128 caracteres, única por requisição. Nonces
  vistos são guardados em cache anti-replay (TTL = 2× a janela); nonces
  expirados são limpos preguiçosamente.
- Body hash: `SHA-256` em **hex minúsculo**.
  - Para `GET`/`HEAD` (sem corpo) o valor assinado é
    `SHA-256("")` = `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
  - Para `POST`/`PUT`/`PATCH`/`DELETE` com corpo, é o `SHA-256` sobre a
    representação determinística `JSON.stringify(req.body)` (o mesmo formato
    que o cliente deve serializar antes de assinar). Sem chaves extras,
    sem espaços, sem BOM.
- Assinatura: `HMAC-SHA256` da string canônica com `HMAC_SECRET`,
  codificada em **hex minúsculo**.
- Comparação com `crypto.timingSafeEqual` após checagem de comprimento;
  qualquer falha (chave, timestamp, nonce, assinatura) responde o **mesmo**
  payload `UNAUTHORIZED` — não revela qual etapa falhou.

### Onde a assinatura pode ser gerada — CRÍTICO

`HMAC_SECRET` e `API_KEY` **nunca** podem existir no navegador. Isso implica:

- ❌ O frontend Lovable **não deve** calcular a assinatura diretamente.
- ❌ Variáveis `VITE_*` são embutidas no bundle público — nunca use
  `VITE_API_KEY` ou `VITE_HMAC_SECRET`.
- ✅ A assinatura deve ser gerada por um intermediário de servidor com
  os secrets protegidos: uma Edge Function, um BFF (backend-for-frontend),
  ou outro backend Node. O frontend chama esse intermediário, que
  chama a ERP API assinando a requisição.
- ✅ Esta ERP API Node deve ser publicada por **HTTPS** e acessível
  apenas a partir desse intermediário controlado (allowlist de rede ou
  autenticação de rede).
- ✅ `DEV_BYPASS_AUTH` **jamais** deve ser usado em produção. Já é forçado
  a `false` quando `NODE_ENV=production`, e só funciona vindo do socket
  loopback real (`127.0.0.1` / `::1` / `::ffff:127.0.0.1`); headers
  `x-forwarded-for` são ignorados pelo check de bypass.

A criação da Edge Function/BFF **não faz parte** desta v1.0.0.

Em falha, a resposta é sempre a mesma (não revela qual etapa falhou):

```json
{
  "success": false,
  "error": { "code": "UNAUTHORIZED", "message": "Não autorizado.", "retryable": false }
}
```

---

## Boas práticas de segurança

- Nunca commite `.env` — use o `.env.example`.
- Evite `SYSDBA`/`masterkey`. Não são bloqueados pela aplicação (o
  administrador pode legitimamente configurá-los em ambientes internos),
  mas ao usar `SYSDBA` a API emite um **aviso de segurança** no logger
  durante o boot. **Recomendação**: criar um usuário Firebird dedicado
  com permissões mínimas (`SELECT` apenas nas tabelas necessárias) e
  usar esse usuário nas variáveis `FIREBIRD_USER`/`FIREBIRD_PASSWORD`.
- A senha do Firebird nunca é comparada a valores conhecidos nem escrita em log.
- Gere `HMAC_SECRET` e `API_KEY` com `openssl rand -hex 32`.
- CORS deve ter allowlist explícita em produção (`CORS_ORIGINS`).
- Logs redijem `x-api-key`, `x-signature`, `x-nonce`, `authorization`, `password`.
- Nenhum detalhe interno do Firebird (SQL, host, path do banco, stack) é exposto ao cliente.
- `trust proxy` está configurado como `"loopback"`. Se um proxy reverso
  real for adicionado à frente da API, ajustar conforme o proxy usado
  (nunca use `true` cegamente — permitiria falsificar `req.ip`).

---

## Estrutura de pastas

```
erp-api/
├── server.js
├── package.json
├── .env.example
├── .gitignore
├── README.md
└── src/
    ├── app.js
    ├── config/
    │   ├── env.js
    │   ├── firebird.js
    │   └── logger.js
    ├── middleware/
    │   ├── auth.middleware.js
    │   ├── cors.middleware.js
    │   ├── error.middleware.js
    │   ├── not-found.middleware.js
    │   ├── rate-limit.middleware.js
    │   ├── request-id.middleware.js
    │   └── request-logger.middleware.js
    ├── modules/
    │   ├── health/
    │   │   ├── health.controller.js
    │   │   ├── health.routes.js
    │   │   └── health.service.js
    │   └── operations/   (placeholder — sem endpoints ainda)
    │       ├── operations.controller.js
    │       ├── operations.mapper.js
    │       ├── operations.repository.js
    │       ├── operations.routes.js
    │       ├── operations.service.js
    │       └── operations.validator.js
    └── shared/
        ├── database/firebird-client.js
        ├── errors/app-error.js
        ├── http/response.js
        └── utils/async-handler.js
```

---

## Próximos módulos planejados

- `operations/` — listagem/consulta de pedidos (leitura)
- `customers/` — clientes
- `equipments/` — equipamentos
- `financial/` — financeiro

**Nesta v1.0.0 não existe endpoint de pedidos, clientes, equipamentos ou financeiro.**

---

## Status dos critérios de aceite

1. ✅ Instala com `npm install`
2. ✅ Inicia com `npm run dev`
3. ✅ `GET /api/v1/health` responde 200
4. ✅ `GET /api/v1/health/erp` testa o Firebird de verdade (`SELECT 1 FROM RDB$DATABASE`)
5. ✅ `/health/erp` exige HMAC fora do bypass local
6. ✅ Variáveis obrigatórias ausentes impedem o boot
7. ✅ Nenhuma credencial no código
8. ✅ Nenhum detalhe interno do Firebird exposto
9. ✅ Erros seguem o contrato padronizado
10. ✅ Estrutura modular pronta para crescer
11. ✅ Sem endpoints de pedidos
12. ✅ Versão única (lida de `package.json`)
13. ✅ README completo
14. ✅ CommonJS
15. ✅ Responsabilidades separadas por camada