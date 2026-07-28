# Sprint 6 — Descoberta da Criação de Pedidos (ERP Firebird)

> **Escopo:** análise e documentação. Nenhum endpoint criado, nenhuma escrita,
> nenhuma procedure/trigger/tabela alterada, nenhuma migração.
>
> **Status de evidência:** este documento separa explicitamente o que é
> **CONFIRMADO** (comprovado por código já em produção nesta API, executado com
> sucesso contra o Firebird real) do que é **A CONFIRMAR** (só pode ser
> respondido lendo o catálogo do banco produtivo, o que exige rodar o script
> abaixo no servidor Windows). Nada aqui foi presumido.

---

## 0. Como completar a descoberta (obrigatório antes da Sprint 7)

O ambiente Lovable não alcança o Firebird. Foi entregue um script **somente
leitura** que produz todo o material factual restante:

```
cd erp-api
node scripts/inspect-order-creation.js            # resumo
node scripts/inspect-order-creation.js --source   # + código-fonte de triggers/procedures
node scripts/inspect-order-creation.js --source > docs/order-creation-dump.txt
```

Ele consulta apenas `RDB$*` (catálogo) e imprime:

| Seção do script | Responde ao item do briefing |
| --- | --- |
| Colunas + NOT NULL + DEFAULT + PK/FK/UNIQUE de `ORDENS_VENDA` | 1. Cabeçalho |
| Idem para `ITENS_ORDENS_VENDA` e `EQUIP_ORDENS_VENDA` | 2. Itens |
| Generators com nome `%ORDEN%/%PEDIDO%/%VENDA%` + valor atual | 3. Numeração |
| Triggers das 3 tabelas: tipo, ordem, ativa/inativa, fonte | 4. Triggers |
| Procedures `%ORDEN%/%ITENS%/%EQUIP%`: parâmetros IN/OUT + fonte | 5. Procedures |
| FKs de outras tabelas apontando para `ORDENS_VENDA` | 6. Dependências |

O script reusa `scripts/lib/introspect.js`, cujo guard recusa qualquer SQL que
não comece com `SELECT`. Nenhum dado de cliente/pedido é impresso — só
metadados.

---

## 1. Cabeçalho do pedido — `ORDENS_VENDA`

### CONFIRMADO

A API **nunca** insere diretamente em `ORDENS_VENDA`. Toda criação passa por
`SP_CAD_ORDEM_VENDA_COMPLETO`, com 30 parâmetros posicionais
(`src/modules/orders/orders.mapper.js`, em produção):

| # | Parâmetro | Origem na API |
| --- | --- | --- |
| 0 | `ID_EMPRESA` | regra oficial (`shared/company/company-rule.js`) → 1 ou 3 |
| 1 | `ID_CLIENTE` | payload |
| 2 | `ID_VENDEDOR` | payload |
| 3 | `ID_TIPO_VENDA` | payload |
| 4 | `ID_PRAZO` | payload |
| 5 | `ID_FORMA_PAGAMENTO` | payload |
| 6 | `ENTREGAR` | 0/1 |
| 7 | `DATA_PREV_ENTREGA` | payload (TIMESTAMP; fonte oficial do horário de entrega) |
| 8 | `DATA_ENTREGA` | payload, pode ser nulo |
| 9 | `BUSCAR_EQUIP` | 0/1 |
| 10–11 | `DATA_RETORNO`, `DATA_PREV_RETORNO` | payload, podem ser nulos |
| 12–13 | `VALOR`, `VALOR_FRETE` | payload |
| 14–20 | `UF`, `CIDADE`, `BAIRRO`, `RUA`, `NUMERO`, `COMP`, `CEP` | endereço (truncado por `LIMITS`) |
| 21 | `OBS` | opcional |
| 22 | `GERA_COBRANCA` | **fixo = 1** (regra de negócio; nunca do frontend) |
| 23 | `SAIDA_ESTOQUE` | **fixo = 0** |
| 24 | `ID_USER` | **fixo = 2** (`CAD_USER`) |
| 25 | `CHAVE` | **NULL = criar** (não-nulo = outra operação da procedure) |
| 26–27 | `ID_TRANSPORTADOR`, `ID_TRANSPORTADOR_VEICULO` | opcionais |
| 28 | `PERCENT_DESC_COMERCIAL` | payload |
| 29 | `ID_PDV_SESSAO` | opcional |

Colunas confirmadas por leitura (`orders.repository.js`, `operations`, `map`):
`ID_ORDENS_VENDA` (PK), `N_PEDIDO`, `ID_EMPRESA`, `ID_STATUS` (FK → `STATUS`),
`ID_CLIENTE` (FK → `CLIENTES`), `DATA_PREV_ENTREGA`.

A procedure é **selecionável** e devolve `ID` — a API o consome via
`SELECT ID FROM SP_CAD_ORDEM_VENDA_COMPLETO(...)`. O `N_PEDIDO` **não** é
devolvido pela procedure: a API o relê com `SELECT ... FROM ORDENS_VENDA WHERE
ID_ORDENS_VENDA = ?` dentro da mesma transação.

### A CONFIRMAR (saída do script)

- lista completa de colunas `NOT NULL` sem default → conjunto mínimo real;
- defaults declarados (coluna e domínio);
- FKs completas (status, tipo de venda, prazo, forma de pagamento, transportador);
- colunas preenchidas por trigger (ver §4) e portanto proibidas ao chamador.

---

## 2. Itens do pedido — `ITENS_ORDENS_VENDA`

### CONFIRMADO

Inserção **exclusivamente** por `SP_CAD_ITENS_ORDENS_VENDA`, selecionável,
6 parâmetros posicionais:

```
(ID_ORDENS_VENDA, ID_PRODUTO, PRECO_UNIT, QTDE_PEDIDA, DESCONTO, CHAVE='I')
```

- `CHAVE = 'I'` → inclusão. A mesma procedure atende outras operações por chave.
- O relacionamento com o cabeçalho é por `ID_ORDENS_VENDA`, obtido da procedure
  do cabeçalho **antes** de qualquer item.
- **Preço e desconto hoje vêm do chamador.** A API não recalcula; a validação é
  apenas aritmética (soma dos itens × total). A resolução oficial de preço já
  existe como leitura isolada (`GET /api/v1/pricing/resolve`, Sprint 5) mas
  **ainda não** está acoplada à criação — este é o principal risco (§8).
- Não há parâmetro de imposto na assinatura da procedure. Se houver cálculo
  fiscal, ele ocorre **dentro** da procedure/trigger, não no chamador.

Equipamentos: `SP_CAD_EQUIP_ORDENS_VENDA(ID_ORDENS_VENDA, ID_TIPO_EQUIPAMENTO,
ID_PRODUTO, QTDE, CHAVE='I')` — executada como `EXECUTE PROCEDURE` (não
selecionável).

### A CONFIRMAR

- colunas de total por item (`VALOR_TOTAL`/`SUBTOTAL`) — preenchidas por trigger
  ou pela procedure?
- existem colunas fiscais (`ICMS`, `IPI`, `CFOP`, `NCM`)? São calculadas onde?
- `QTDE_ENTREGUE`/saldo existe? É zerada na inclusão?

---

## 3. Numeração do pedido (`N_PEDIDO`)

### CONFIRMADO

- O **`ID_ORDENS_VENDA`** vem de um generator global. Está documentado no
  serviço em produção (`orders.service.js`) que `SP_CAD_ORDEM_VENDA` lê o ID
  recém-inserido via **`GEN_ID(GEN_ORDENS_VENDA_ID, 0)`** — leitura sem
  incremento, portanto sensível a concorrência. Por causa disso a API mantém um
  **mutex global in-process** (`withGlobalOrderLock`) serializando todas as
  criações. Esse é um fato do banco, não uma escolha estética.
- O **`N_PEDIDO`** é atribuído pelo ERP (a API só o relê depois). **Não** é
  calculado na aplicação Node.

### A CONFIRMAR (crítico para a Sprint 7)

Qual dos três mecanismos gera `N_PEDIDO`:

1. generator dedicado (`GEN_N_PEDIDO`, ou por empresa);
2. trigger `BEFORE` de gravação em `ORDENS_VENDA`;
3. `MAX(N_PEDIDO)+1` dentro da procedure (o pior caso — colide sob concorrência).

A seção "GENERATORS" + a fonte das triggers no dump respondem isso de forma
definitiva. **Não adotar hipótese.**

---

## 4. Triggers

### A CONFIRMAR — integralmente pelo dump

O script lista, para `ORDENS_VENDA`, `ITENS_ORDENS_VENDA` e
`EQUIP_ORDENS_VENDA`: nome, tipo decodificado (antes/depois de gravação,
alteração ou remoção), ordem de execução, se está inativa e o código-fonte.

Ao documentar cada trigger, classifique-a em uma destas categorias — é isso que
decide o desenho da Sprint 7:

| Categoria | Consequência para a escrita |
| --- | --- |
| Atribui chave/numeração | o chamador **não** pode enviar o valor |
| Recalcula totais do cabeçalho a partir dos itens | totais enviados são apenas conferência |
| Movimenta estoque | `SAIDA_ESTOQUE=0` precisa ser reavaliado |
| Gera financeiro/cobrança | interage com `GERA_COBRANCA=1` |
| Grava auditoria/histórico | exige `ID_USER` coerente (hoje fixo em 2) |
| Valida e lança exceção | vira erro de negócio a ser mapeado na API |

Indício já observado em produção: o pedido criado retorna com `ID_STATUS`
preenchido sem que a API o envie → **existe** atribuição automática de status
(default de coluna ou trigger). Confirmar qual.

---

## 5. Procedures

### CONFIRMADO (as três já usadas em produção)

| Procedure | Finalidade | Forma de chamada | Obrigatória? |
| --- | --- | --- | --- |
| `SP_CAD_ORDEM_VENDA_COMPLETO` | cria o cabeçalho e devolve `ID` | `SELECT ID FROM ...(30 params)` | **sim** — é o ponto de entrada oficial |
| `SP_CAD_ITENS_ORDENS_VENDA` | inclui item (`CHAVE='I'`) | `SELECT ID FROM ...(6 params)` | **sim**, se houver itens |
| `SP_CAD_EQUIP_ORDENS_VENDA` | inclui equipamento (`CHAVE='I'`) | `EXECUTE PROCEDURE (5 params)` | opcional |

`SP_CAD_ORDEM_VENDA_COMPLETO` **repassa por posição** para
`SP_CAD_ORDEM_VENDA` (regra registrada: `GERA_COMANDA` recebe o valor de
`GERA_COBRANCA`). Ou seja, `_COMPLETO` é um wrapper — a lógica real está na
procedure interna.

### A CONFIRMAR

- fonte de `SP_CAD_ORDEM_VENDA` (a interna): o que faz com `GERA_COBRANCA`,
  `SAIDA_ESTOQUE` e `CHAVE`;
- existem procedures auxiliares de total/fechamento (`SP_*TOTAL*`,
  `SP_*FECHA*`) que o ERP chama depois dos itens? Se sim, a API **não** as
  chama hoje.

---

## 6. Dependências

### CONFIRMADO

A criação atual roda em **uma única transação** (`firebird.withTransaction`) e
só toca as três procedures acima. Nenhuma inserção manual em faturamento,
estoque, financeiro, comissão ou auditoria é feita pela API — o que dessas
coisas acontece, acontece **dentro** das procedures/triggers.

### A CONFIRMAR

A seção final do dump lista todas as tabelas com FK para `ORDENS_VENDA`
(cobrança, comanda, movimento de estoque, histórico, etc.). Para cada uma,
registrar: é preenchida pela procedure, por trigger, ou fica vazia? Uma tabela
dependente que o ERP legado preenche e a API não é uma **divergência funcional
silenciosa** — é o tipo de coisa que só aparece semanas depois no faturamento.

---

## 7. Fluxo oficial (comportamento real hoje)

```
Requisição validada (Zod) + Idempotency-Key
        ↓
Mutex global in-process  (serializa criações distintas)
        ↓
BEGIN TRANSACTION (única)
        ↓
Resolver ID_EMPRESA  (payload → cliente → grupo GROTT → 1)
        ↓
SP_CAD_ORDEM_VENDA_COMPLETO(CHAVE=NULL, GERA_COBRANCA=1, SAIDA_ESTOQUE=0, ID_USER=2)
        ↓  (procedure interna SP_CAD_ORDEM_VENDA + generator + triggers do banco)
        ↓  devolve ID_ORDENS_VENDA;  N_PEDIDO e ID_STATUS atribuídos pelo ERP
        ↓
Para cada item:        SP_CAD_ITENS_ORDENS_VENDA(..., CHAVE='I')
        ↓
Para cada equipamento: SP_CAD_EQUIP_ORDENS_VENDA(..., CHAVE='I')
        ↓
SELECT ORDENS_VENDA → confirma ID, N_PEDIDO, ID_EMPRESA, status
        ↓
COMMIT   (qualquer exceção ⇒ ROLLBACK integral)
        ↓
Persistir resultado na store de idempotência (replay seguro)
```

Lacuna conhecida do fluxo: **não há etapa de recálculo/fechamento de totais** —
assume-se que a procedure ou as triggers fazem isso. O dump precisa provar.

---

## 8. Riscos identificados

| # | Risco | Gravidade | Observação |
| --- | --- | --- | --- |
| R1 | Preço unitário vem do cliente da API | **alta** | permite gravar preço arbitrário no ERP; a resolução oficial (Sprint 5) existe mas não está acoplada |
| R2 | `N_PEDIDO` com origem não comprovada | **alta** | se for `MAX+1` na procedure, há colisão real sob concorrência |
| R3 | `GEN_ID(...,0)` + mutex apenas in-process | **alta** | quebra em PM2 cluster / múltiplas instâncias; hoje só é seguro em instância única |
| R4 | Triggers não catalogadas | média | efeitos colaterais (estoque, financeiro) desconhecidos e não testados |
| R5 | `SAIDA_ESTOQUE=0` fixo | média | pode divergir do que o ERP legado faz para o mesmo tipo de venda |
| R6 | `ID_USER=2` fixo | média | auditoria do ERP atribui tudo a um usuário só |
| R7 | Sem ambiente de homologação Firebird | **alta** | qualquer teste de escrita hoje sujaria a base produtiva |
| R8 | Erros da procedure viram `ORDER_CREATE_FAILED` genérico | baixa | bom para segurança, ruim para diagnóstico; faltam códigos de negócio |

---

## 9. Recomendação para a Sprint 7

**Pré-condições (bloqueantes):**

1. Rodar `node scripts/inspect-order-creation.js --source` na base real e anexar
   o dump; preencher §1–§6 com os fatos. Sem isso, a Sprint 7 é adivinhação.
2. Definir uma **cópia restaurada** do Firebird para teste de escrita.

**Ordem sugerida de implementação:**

1. **Preço no servidor (R1).** Na criação, resolver o preço via módulo
   `pricing` e **ignorar** o preço enviado — ou aceitá-lo apenas como
   conferência, rejeitando divergência com `PRICE_MISMATCH`.
2. **Numeração (R2/R3).** Conforme o dump: se `N_PEDIDO` vier de generator,
   remover o mutex global; se vier de `MAX+1`, manter o mutex **e** promovê-lo a
   lock no próprio Firebird (`SELECT ... WITH LOCK` em tabela de coordenação),
   pois o lock in-process não sobrevive a múltiplas instâncias.
3. **Mapear triggers para regras (R4/R5).** Cada efeito colateral vira um teste
   de contrato: criar em base de teste e verificar as tabelas dependentes.
4. **Erros de negócio (R8).** Traduzir exceções nomeadas da procedure em códigos
   estáveis da API, sem vazar SQL.
5. **Só então** expor a criação ao frontend, atrás de dupla conferência de total
   (itens × total × frete × desconto comercial).

**Manter como está:** transação única, idempotência com hash de payload,
`GERA_COBRANCA=1`, `CAD_USER=2`, resolução oficial de empresa. Nada disso deve
ser reaberto na Sprint 7.
---

# Sprint 6.1 — Descoberta final: triggers e procedures

> **Escopo:** descoberta. Nenhum endpoint, service, repository, controller,
> migração, procedure, trigger ou teste foi criado. Nenhuma estrutura existente
> foi alterada. **Nenhuma escrita foi realizada no Firebird** — todo SQL do
> mecanismo de introspecção passa pelo guard de `scripts/lib/introspect.js`,
> que recusa qualquer comando que não comece com `SELECT` e bloqueia palavras
> de escrita/DDL.

## 6.1.0 Situação factual

O ambiente onde este agente executa **não tem rota de rede até o Firebird**
(o banco fica no servidor Windows da operação). Por isso o código-fonte das
triggers e das procedures não pode ser lido daqui: ele existe apenas dentro do
catálogo do banco produtivo.

Documentar esse código de memória ou por inferência seria violar a regra
"não assumir hipóteses". A entrega desta Sprint é, portanto, o **mecanismo que
produz o documento final com o código-fonte real**, executado por quem tem
acesso ao banco, mais a estrutura do relatório já pronta para receber os fatos.

## 6.1.1 O que executar (uma linha)

```
cd erp-api
node scripts/inspect-order-source.js --out docs/ORDER-CREATION-SOURCE.md
```

Saída: `docs/ORDER-CREATION-SOURCE.md`, um relatório Markdown completo e
autocontido. Sem `--out`, imprime no console.

O script `scripts/inspect-order-creation.js` (Sprint 6) continua válido para o
resumo interativo; `inspect-order-source.js` é o entregável documental.

## 6.1.2 O que o relatório gerado contém

| Seção gerada | Item do briefing 6.1 | Fonte no catálogo |
| --- | --- | --- |
| **1. Triggers** — por tabela: nome, BEFORE/AFTER, INSERT/UPDATE/DELETE, posição, ativa/inativa, objetos referenciados e **código-fonte integral** | 1 | `RDB$TRIGGERS`, `RDB$DEPENDENCIES` |
| **2. Procedures** — nome, parâmetros IN, parâmetros OUT, dependências e **código-fonte integral**, com **resolução recursiva**: toda procedure chamada por outra entra na fila e também é dumpada | 2 | `RDB$PROCEDURES`, `RDB$PROCEDURE_PARAMETERS`, `RDB$DEPENDENCIES` |
| **3. Numeração** — generators relevantes + valor atual, e uma tabela com **todas as linhas de trigger/procedure que citam `N_PEDIDO`**, seguida de conclusão automática (generator vs `MAX()+1`) | 3 | `RDB$GENERATORS`, `GEN_ID(x, 0)` (leitura sem incremento) |
| **4. Campos automáticos** — por tabela: coluna, obrigatoriedade, `DEFAULT` (de coluna e de domínio), coluna calculada e **qual trigger atribui `NEW.<coluna>`**; fecha com a lista de obrigatórias que o chamador precisa fornecer | 4 | `RDB$RELATION_FIELDS`, `RDB$FIELDS`, fonte das triggers |
| **5. Dependências** — tabelas adicionais referenciadas pelas procedures/triggers e tabelas com FK para `ORDENS_VENDA`; declara explicitamente quando não há nenhuma | 5 | `RDB$DEPENDENCIES`, `RDB$RELATION_CONSTRAINTS` |

Ponto de partida da varredura de procedures: `SP_CAD_ORDEM_VENDA_COMPLETO`,
`SP_CAD_ORDEM_VENDA`, `SP_CAD_ITENS_ORDENS_VENDA`, `SP_CAD_EQUIP_ORDENS_VENDA`
mais tudo que casa com `%ORDEN%`, `%ORDEM%`, `%PEDIDO%`, `%ITENS%`, `%EQUIP%`.
A partir daí a fila cresce sozinha por `RDB$DEPENDENCIES`, cobrindo procedures
usadas **indiretamente** (o item 2 do briefing).

### Classificação automática de comportamento

Para cada trigger e procedure o relatório imprime uma linha
"comportamento observado na fonte", detectando na própria fonte: uso de
`GEN_ID`, referência a `N_PEDIDO`, `MAX(N_PEDIDO)+1`, movimentação de
estoque/saldo, geração de cobrança/comanda/financeiro, histórico/auditoria,
`EXCEPTION` de validação, cálculo de totais, carimbo de data/hora e atribuição
de `ID_STATUS`. É leitura da fonte real — não inferência sobre o que "deveria"
existir. A explicação resumida exigida pelo briefing sai dessa linha somada ao
bloco de código logo abaixo.

## 6.1.3 Numeração de `N_PEDIDO` — estado da confirmação

Confirmado por código em produção (Sprints anteriores): `ID_ORDENS_VENDA` vem
de generator lido com `GEN_ID(GEN_ORDENS_VENDA_ID, 0)` dentro de
`SP_CAD_ORDEM_VENDA`, e `N_PEDIDO` é atribuído pelo ERP — a API apenas o relê
após a chamada, na mesma transação.

**Ainda não confirmado, e resolvido pela seção 3 do relatório gerado:** qual
objeto atribui `N_PEDIDO` (trigger BEFORE INSERT, a procedure, ou default de
coluna), qual generator ele consome e em que momento da transação. O script
imprime as linhas literais que tocam `N_PEDIDO`, o que torna a resposta
verificável em vez de opinativa. Enquanto isso não estiver anexado, **o risco
R2 permanece aberto e a Sprint 7 não deve começar**.

## 6.1.4 Sequência real da criação — o que já é fato

A sequência executada hoje pela API está descrita em §7 deste documento e é
comprovada por código em produção. O que o relatório da 6.1 acrescenta é a
**camada interna** de cada passo: quais triggers disparam entre a chamada da
procedure e o commit, e em que ordem (`RDB$TRIGGER_SEQUENCE`). A ordem
completa só pode ser afirmada com o dump em mãos.

## 6.1.5 Riscos identificados nesta Sprint

| # | Risco | Gravidade |
| --- | --- | --- |
| R9 | Código-fonte de triggers/procedures indisponível fora do servidor da operação — qualquer decisão da Sprint 7 tomada agora é hipótese | **alta** |
| R10 | Triggers inativas (`RDB$TRIGGER_INACTIVE = 1`) podem existir e mascarar regras que o ERP legado assume ativas em outra instalação | média |
| R11 | Procedures chamadas indiretamente podem tocar tabelas fora do grafo de FK — por isso a varredura é recursiva por dependência, não por nome | média |
| R12 | Colunas com `DEFAULT` no **domínio** (não na coluna) passam despercebidas em inspeções superficiais; o relatório lê as duas origens | baixa |

## 6.1.6 Declaração de conformidade

- Nenhum endpoint, service, repository, controller, migração, trigger,
  procedure ou teste foi criado.
- Nenhuma estrutura existente foi alterada.
- Nenhum `INSERT`, `UPDATE`, `DELETE` ou execução de procedure que modifique
  dados foi emitido — o guard read-only rejeita esses comandos por construção,
  e o teste `nenhum script de introspecção contém SQL de escrita` cobre o novo
  script.
- **Nenhuma escrita foi realizada no Firebird.**

## 6.1.7 Entrega pendente (bloqueante da Sprint 7)

Rodar a linha de 6.1.1 no servidor Windows e anexar
`docs/ORDER-CREATION-SOURCE.md`. Com esse arquivo, fecho aqui as seções §1–§6
com o código-fonte real e a sequência definitiva de execução.
