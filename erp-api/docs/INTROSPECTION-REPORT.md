# Relatório de Introspecção Comercial — ERP API v1.5.0

> Este documento é o **entregável de conhecimento** da Sprint 2. Ele descreve o
> que a API passa a saber sobre o ERP, o que **ainda não** sabe, e o que ficou
> deliberadamente fora de escopo. Nada aqui é suposição implementada: quando um
> campo não é confirmado pela introspecção em runtime, o contrato devolve `null`.

## 1. Como a introspecção funciona

`src/shared/database/schema-introspection.js` consulta o catálogo do próprio
Firebird (`RDB$RELATION_FIELDS`) e responde: *esta coluna existe nesta tabela?*
O resultado é cacheado por processo. O módulo de clientes usa isso para montar
o `SELECT` apenas com colunas confirmadas.

Consequências práticas:

- Instalações com nomes de coluna diferentes (`ATIVO` vs `SITUACAO` vs `INATIVO`)
  funcionam sem alteração de código.
- Campo ausente **nunca** vira `false` ou `0` — vira `null` no contrato.
- Nenhuma entrada do usuário entra em SQL. Os únicos trechos dinâmicos são
  nomes de coluna vindos do catálogo do banco; todo valor é parametrizado.

Scripts administrativos (somente leitura, com guarda que recusa qualquer SQL
que não seja `SELECT`):

| Script | Domínio |
| --- | --- |
| `scripts/inspect-client-schema.js` | Clientes, pessoas, grupos, contatos, endereço |
| `scripts/inspect-pricing-schema.js` | Preços e tabelas de preço |
| `scripts/inspect-payment-schema.js` | Formas e condições de pagamento |
| `scripts/inspect-product-schema.js` | Produtos, grupos, unidades |
| `scripts/inspect-equipment-schema.js` | Equipamentos e tipos |
| `scripts/diagnose-search-collation.js` | Charset, collation e acentuação |

Execute-os no servidor Windows que enxerga o Firebird:

```
node scripts/inspect-client-schema.js
```

Eles imprimem **apenas metadados e contagens agregadas** — nunca linhas de
clientes, nomes ou documentos.

## 2. Regra oficial de empresa (centralizada)

`src/shared/company/company-rule.js` é agora a **única** implementação:

```
ID_EMPRESA = 3 → Grott
ID_EMPRESA = 1 → Graal
```

Prioridade: empresa explícita do registro → empresa do cliente → grupo com
"GROTT" na descrição → fallback `1`. `orders.mapper.js` e
`operations.mapper.js` passaram a delegar para ela; o comportamento anterior
foi preservado e está coberto por testes.

O parâmetro `companyId` do endpoint de busca **filtra** o resultado; ele nunca
redefine a empresa resolvida do cadastro.

## 3. Endpoints entregues (somente leitura)

### `GET /api/v1/clients`

Filtros: `q` (nome/apelido/id/documento, mín. 3 caracteres), `document`,
`phone`, `city`, `companyId` (1 ou 3), `limit` (padrão 20, teto 50), `cursor`.
Pelo menos um filtro é obrigatório — não existe "listar tudo".

Paginação **keyset** por `ID_CLIENTE ASC`. O `nextCursor` é o maior ID varrido
na página (não o último item exibido), de modo que o filtro por `companyId`
aplicado após a resolução nunca causa loop nem salto de registros.

### `GET /api/v1/clients/:clientId`

Detalhe do cliente, superset do item de listagem.

Ambos exigem HMAC. Documentos e telefones são **sempre** mascarados; o valor
integral nunca sai da API. Erros do banco viram `CLIENT_QUERY_FAILED` sem SQL,
tabela ou stack no corpo da resposta.

## 4. Busca com acento

O diagnóstico confirmou que a collation padrão do charset WIN1252 não é
accent-insensitive. Em vez de carregar a tabela em memória, o termo vira um
padrão `LIKE` onde cada letra com variantes acentuadas é trocada pelo coringa
de um caractere:

```
"Jose"  → %J_S_%    casa com JOSE e JOSÉ
"João"  → %J___%    casa com JOAO e JOÃO
```

A busca envia o padrão exato **e** o padrão com folding. Coringas digitados
pelo usuário (`%`, `_`) são neutralizados antes de montar o padrão.

Limitação conhecida: o folding aumenta o recall e pode trazer homógrafos
(`J_S_` também casaria com "JUSA"). Como a busca tem teto de 50 itens e exige
filtro, isso é aceitável nesta fase. Rodar
`scripts/diagnose-search-collation.js` na base real permite decidir se vale
criar índice com collation `_CI_AI` numa próxima sprint.

## 5. Endereço do cliente

Ordem de resolução: endereço **cadastral** estruturado
(`ID_RUA`/`ID_BAIRRO`/`ID_CIDADE`/`ID_ESTADO`/`CEP`) → fallback para o endereço
do **último pedido**. O contrato sempre informa a origem em `addressOrigin`
(`registered` | `last_order`), para que a UI nunca apresente um endereço
inferido como se fosse cadastro.

## 6. Lacunas — o que ainda NÃO está resolvido

- **Preços**: a cascata (cliente → grupo → padrão) foi apenas mapeada, não
  implementada. Os critérios de vigência e desempate precisam ser confirmados
  na base real antes de virar código.
- **Pagamentos**: falta confirmar a diferença semântica entre
  `FORMA_PAGAMENTO` e `FPGTO`, qual coluna de `CLIENTES` guarda a forma padrão
  e qual guarda o prazo, e a regra específica de boleto.
- **Produtos**: resolvido na Sprint 3 (v1.6.0) — `GET /api/v1/products` e
  `GET /api/v1/products/:productId`, somente leitura e sem preços. Ver
  `docs/CATALOG-READONLY.md`.
- **Equipamentos**: `GET /api/v1/equipment-types` entregue na Sprint 3, mas a
  lacuna permanece: não há categoria estruturada que separe chopeira /
  cilindro / barril retornável. A API devolve `category: null` e
  `returnable: null` em vez de inferir por descrição. O frontend continua
  usando heurística; isso é temporário e não é regra oficial.
- **`npm audit`** não pôde ser executado no ambiente de build (o proxy de
  registro usado aqui não expõe o endpoint de auditoria). Rode
  `npm audit` no servidor Windows antes do deploy.

## 7. Escopo respeitado

Nenhuma escrita no Firebird. Nenhuma alteração no frontend, no Supabase ou no
módulo de pedidos. Nenhum endpoint de preço, produto ou pagamento foi criado.
