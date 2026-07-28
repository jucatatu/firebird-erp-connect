# Catálogo ERP somente leitura — Sprint 3 (v1.6.0)

Camada de leitura de **produtos** e **tipos de equipamento**. Nenhuma escrita
no Firebird, nenhum preço, nenhum Supabase, nenhuma alteração de frontend.

## Princípio

O schema do ERP não é controlado por este projeto. Cada coluna usada é
confirmada em runtime pelo catálogo do Firebird
(`src/shared/database/schema-introspection.js`). Coluna não confirmada →
campo `null` no contrato. Nunca `false`, `0` ou `""`.

Nenhuma entrada do usuário entra em SQL. Os únicos trechos dinâmicos são
nomes de coluna vindos do catálogo, validados como identificadores; todo
valor é parametrizado. As projeções são explícitas — nunca `SELECT *`.

## `GET /api/v1/products`

HMAC obrigatório. Pelo menos um filtro é obrigatório — não existe "listar tudo".

| Parâmetro | Regra |
| --- | --- |
| `q` | 3–60 caracteres; casa descrição, código e (se numérico) o ID |
| `productId` | inteiro positivo |
| `code` | igualdade exata, máx. 30 caracteres |
| `groupId` / `unitId` | inteiro positivo |
| `companyId` | 1 ou 3; **400** se o ERP não vincular produto a empresa |
| `active` | `true`/`false`; ignorado se a coluna não existir |
| `limit` | padrão 20, teto 50 |
| `cursor` | cursor opaco devolvido em `nextCursor` |

Qualquer parâmetro desconhecido → `400 VALIDATION_ERROR`.

Item: `id`, `code`, `description`, `unit {id, code, description}`,
`group {id, description}`, `companyId`, `active`, `blocked`, `discontinued`.
O detalhe (`GET /api/v1/products/:productId`) é superset e acrescenta
`barcode` e `deleted`. **Nenhum campo de preço é exposto** — preços não fazem
parte desta sprint.

### Paginação

Keyset por ID do produto ASC. `nextCursor` é o **maior ID varrido** na página
(não o último item exibido), de modo que filtros aplicados após a consulta
(`active`) nunca causem loop nem salto de registros.

O cursor é **opaco**: Base64URL de `{"v":1,"lastId":<int>}`
(`src/shared/pagination/keyset-cursor.js`). A decodificação valida versão,
formato, chaves e faixa. Nenhum SQL, nome de coluna ou limite trafega nele;
cursor forjado, com campos extras ou versão errada → `400`.

## `GET /api/v1/equipment-types`

HMAC obrigatório. Catálogo pequeno e estável: sem paginação, com teto rígido
(`limit` padrão 100, máx. 200) e `truncated: true` quando o teto é atingido.
Filtros: `q` (mín. 2 caracteres) e `active`.

Item: `id`, `code`, `description`, `companyId`, `active`, `category`,
`returnable`.

> **`category` e `returnable` são sempre `null` — de propósito.**
> A introspecção não encontrou coluna estruturada que separe
> chopeira / cilindro / barril retornável. Classificar por regex sobre a
> descrição seria heurística disfarçada de regra oficial. A decisão continua
> explicitamente no frontend até existir dado estruturado no ERP (ou uma
> tabela de mapeamento própria, fora do Firebird).

## Busca com acento

`src/shared/search/like-pattern.js` (compartilhado pelos dois módulos):
o termo vira um padrão `LIKE` onde cada letra com variantes acentuadas
(A E I O U C N) é trocada pelo coringa de um caractere.

```
"eletrica" → %_L_TR___%   casa com ELETRICA e ELÉTRICA
```

O padrão exato e o padrão com folding são enviados juntos. Coringas digitados
(`%`, `_`) são neutralizados. Limitação conhecida (idem clientes): o folding
aumenta o recall e pode trazer homógrafos — aceitável com teto de 50 itens e
filtro obrigatório.

## Erros

| Código | Situação |
| --- | --- |
| `VALIDATION_ERROR` (400) | parâmetro ausente, inválido, desconhecido ou cursor forjado |
| `PRODUCT_NOT_FOUND` (404) | produto inexistente |
| `PRODUCT_QUERY_FAILED` (500) | falha ao consultar produtos |
| `EQUIPMENT_TYPE_QUERY_FAILED` (500) | falha ao consultar tipos de equipamento |

Erros do banco **nunca** expõem SQL, nome de tabela, coluna ou stack.

## Lacunas mantidas

- Preços continuam fora de escopo (cascata cliente → grupo → padrão apenas mapeada).
- Estoque não é consultado.
- Categoria operacional de equipamento permanece sem fonte estruturada.