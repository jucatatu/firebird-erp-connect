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