# SPRINT UI — CARDS COMPACTOS DE PEDIDOS

&nbsp;

## OBJETIVO

&nbsp;

Refinar EXCLUSIVAMENTE a apresentação visual dos cards da listagem de pedidos.

&nbsp;

Objetivos visuais:

&nbsp;

- deixar os cards mais compactos;

- melhorar a leitura no mobile;

- separar melhor Produtos e Equipamentos;

- mostrar quantidade sempre antes da descrição;

- reduzir espaços verticais desnecessários;

- manter status ERP como principal informação operacional;

- preservar 100% da lógica já validada.

&nbsp;

ESTA SPRINT É SOMENTE DE UI.

&nbsp;

==================================================

1. REGRA CRÍTICA — NÃO ALTERAR FUNCIONALIDADE

==================================================

&nbsp;

NÃO alterar:

&nbsp;

- CREATE;

- EDIT;

- hidratação;

- salvamento;

- status ERP;

- batch-status;

- pedidos excluídos;

- ERP INDISPONÍVEL;

- canEdit;

- filtros;

- permissões;

- navegação;

- hooks;

- Zustand;

- React Query;

- Supabase;

- order_drafts;

- Node ERP;

- Firebird;

- equipamentos;

- cobertura;

- assignedProductId;

- logística;

- pagamentos;

- ID_FPGTO;

- Google Maps;

- payloads;

- contratos de API.

&nbsp;

Não refatorar regras de negócio.

&nbsp;

Alterar SOMENTE:

&nbsp;

- helpers de apresentação;

- markup;

- classes;

- espaçamentos;

- tipografia;

- organização visual dos cards.

&nbsp;

NODE ALTERADO: NÃO

&nbsp;

==================================================

2. ARQUIVOS ESPERADOS

==================================================

&nbsp;

Frontend:

&nbsp;

src/lib/order-summary.ts

&nbsp;

src/routes/_authenticated.pedidos-venda.index.tsx

&nbsp;

Evitar alterar qualquer outro arquivo se não for estritamente necessário para

a apresentação visual.

&nbsp;

==================================================

3. HIERARQUIA DO CARD

==================================================

&nbsp;

Manter esta ordem:

&nbsp;

1. Cliente

2. ERP + identificador interno do app

3. Status ERP + sincronização

4. Empresa + data

5. Produtos + Equipamentos

6. Logística

&nbsp;

A leitura rápida deve responder:

&nbsp;

Quem?

↓

Qual pedido?

↓

Qual situação?

↓

O que vai?

↓

Quais equipamentos?

↓

Quando?

&nbsp;

==================================================

4. CLIENTE

==================================================

&nbsp;

Manter o cliente como maior destaque visual.

&nbsp;

Exemplo:

&nbsp;

ROMEU 2

&nbsp;

ou:

&nbsp;

PUCCINI ENTRETENIMENTOS LTDA.

&nbsp;

Não reduzir excessivamente a fonte.

&nbsp;

==================================================

5. IDENTIFICADORES

==================================================

&nbsp;

Manter linha compacta:

&nbsp;

ERP 8666          PED-179AA4

&nbsp;

ERP deve possuir maior peso visual.

&nbsp;

PED deve permanecer secundário/discreto.

&nbsp;

IMPORTANTE:

&nbsp;

Nesta Sprint NÃO alterar PED para APP-0001.

&nbsp;

A alteração de identificador será tratada em Sprint posterior.

&nbsp;

==================================================

6. STATUS

==================================================

&nbsp;

Manter a ordem já aprovada:

&nbsp;

[ ERP: LIBERADO ]   [ ✓ Enviado ao ERP ]

&nbsp;

Status ERP sempre primeiro.

&nbsp;

"Enviado ao ERP" depois.

&nbsp;

O status ERP deve possuir peso visual ligeiramente maior.

&nbsp;

Não alterar regras ou cores semânticas já existentes.

&nbsp;

Preservar estados como:

&nbsp;

ERP: LIBERADO

ERP: EM ANÁLISE

ERP: A ENTREGAR

ERP: ATRASADO

ERP: BLOQUEADO

ERP: EXCLUÍDO

ERP: INDISPONÍVEL

&nbsp;

==================================================

7. EMPRESA E DATA

==================================================

&nbsp;

Mostrar de forma compacta:

&nbsp;

GRAAL • 14/08/2026

&nbsp;

ou:

&nbsp;

GROTT • 14/08/2026

&nbsp;

Reduzir espaço vertical excessivo abaixo desta linha.

&nbsp;

==================================================

8. order-summary.ts — NOVOS HELPERS VISUAIS

==================================================

&nbsp;

Criar helpers de APRESENTAÇÃO que retornem arrays em vez de strings

concatenadas.

&nbsp;

Exemplo:

&nbsp;

getItemList(...)

getEquipmentList(...)

&nbsp;

Esses helpers:

&nbsp;

- não alteram dados;

- não alteram snapshots;

- não alteram objetos originais;

- não alteram quantidade;

- não alteram regras de equipamento.

&nbsp;

Servem exclusivamente para renderização.

&nbsp;

==================================================

9. PRODUTOS — QUANTIDADE PRIMEIRO

==================================================

&nbsp;

Sempre exibir:

&nbsp;

QUANTIDADE + DESCRIÇÃO

&nbsp;

Exemplos:

&nbsp;

10L  CHOPP PILSEN

&nbsp;

20L  CHOPP IPA

&nbsp;

30L  CHOPP PILSEN GROTT

&nbsp;

Nunca:

&nbsp;

CHOPP PILSEN 10L

&nbsp;

A quantidade deve ser fácil de identificar.

&nbsp;

Pode utilizar semibold/bold para a quantidade.

&nbsp;

==================================================

10. EQUIPAMENTOS — QUANTIDADE PRIMEIRO

==================================================

&nbsp;

Sempre:

&nbsp;

QUANTIDADE + DESCRIÇÃO

&nbsp;

Exemplos:

&nbsp;

1x  CHOPEIRA ELÉTRICA 1 VIA

&nbsp;

1x  BARRIL 10L

&nbsp;

2x  BARRIL 20L

&nbsp;

Nunca:

&nbsp;

BARRIL 10L 1x

&nbsp;

ou:

&nbsp;

CHOPEIRA ... 1x

&nbsp;

==================================================

11. UM EQUIPAMENTO POR ITEM VISUAL

==================================================

&nbsp;

Hoje equipamentos podem aparecer concatenados.

&nbsp;

Alterar visualmente para:

&nbsp;

1x CHOPEIRA ELÉTRICA 1 VIA

&nbsp;

1x BARRIL 10L

&nbsp;

Cada equipamento deve possuir seu próprio item visual.

&nbsp;

IMPORTANTE:

&nbsp;

"um equipamento por item" NÃO significa forçar uma única linha física.

&nbsp;

Se o texto for longo no mobile:

&nbsp;

permitir quebra natural.

&nbsp;

Não:

&nbsp;

- usar nowrap;

- criar overflow horizontal;

- diminuir demais a fonte;

- cortar informação importante somente para caber.

&nbsp;

==================================================

12. SIMPLIFICAÇÃO VISUAL DAS CHOPEIRAS

==================================================

&nbsp;

Podemos remover informação de VAZÃO somente da string exibida no card.

&nbsp;

Exemplos:

&nbsp;

CHOPEIRA ELÉTRICA 1 VIA 30L/H

→

CHOPEIRA ELÉTRICA 1 VIA

&nbsp;

CHOPEIRA 2 VIAS 60 L/H

→

CHOPEIRA 2 VIAS

&nbsp;

IMPORTANTE:

&nbsp;

NÃO utilizar regex genérica que remova qualquer informação em litros.

&nbsp;

Preservar:

&nbsp;

BARRIL 10L

BARRIL 20L

BARRIL 30L

BARRIL 50L

&nbsp;

Exemplo obrigatório:

&nbsp;

BARRIL 10L

→

BARRIL 10L

&nbsp;

Nunca:

&nbsp;

BARRIL

&nbsp;

A limpeza deve reconhecer especificamente padrões de vazão:

&nbsp;

30L/H

30 L/H

60L/H

60 L/H

etc.

&nbsp;

Não modificar descrição armazenada.

&nbsp;

Somente visual.

&nbsp;

==================================================

13. DOIS BLOCOS INTERNOS

==================================================

&nbsp;

Criar dois blocos compactos:

&nbsp;

[ PRODUTOS ]   [ EQUIPAMENTOS ]

&nbsp;

Não criar cards pesados dentro do card.

&nbsp;

Utilizar:

&nbsp;

- fundo muito suave;

- borda discreta;

- border-radius;

- padding pequeno;

- sem sombra forte.

&nbsp;

Evitar aparência:

&nbsp;

card dentro de card dentro de card.

&nbsp;

==================================================

14. LAYOUT PREFERENCIAL MOBILE

==================================================

&nbsp;

Quando houver largura suficiente:

&nbsp;

┌────────────────────┐ ┌────────────────────┐

│ PRODUTOS           │ │ EQUIPAMENTOS       │

│                    │ │                    │

│ 10L PILSEN         │ │ 1x CHOPEIRA 1 VIA │

│ 20L IPA            │ │ 1x BARRIL 10L     │

└────────────────────┘ └────────────────────┘

&nbsp;

Mas:

&nbsp;

LEGIBILIDADE TEM PRIORIDADE.

&nbsp;

Se duas colunas deixarem conteúdo comprimido:

&nbsp;

empilhar:

&nbsp;

[ PRODUTOS ]

&nbsp;

[ EQUIPAMENTOS ]

&nbsp;

Não forçar layout lado a lado.

&nbsp;

==================================================

15. PRODUTOS — EXEMPLO

==================================================

&nbsp;

PRODUTOS

&nbsp;

10L  CHOPP PILSEN

&nbsp;

20L  CHOPP IPA

&nbsp;

==================================================

16. EQUIPAMENTOS — EXEMPLO

==================================================

&nbsp;

EQUIPAMENTOS

&nbsp;

1x  CHOPEIRA ELÉTRICA 2 VIAS

&nbsp;

1x  BARRIL 10L

&nbsp;

1x  BARRIL 20L

&nbsp;

==================================================

17. MUITOS ITENS

==================================================

&nbsp;

Evitar que cards cresçam indefinidamente.

&nbsp;

Se houver muitos produtos/equipamentos, pode usar apresentação como:

&nbsp;

10L CHOPP PILSEN

20L CHOPP IPA

+2 itens

&nbsp;

e:

&nbsp;

1x CHOPEIRA 2 VIAS

1x BARRIL 10L

+3 equipamentos

&nbsp;

SOMENTE se puder ser feito puramente na apresentação.

&nbsp;

Não cortar arrays.

&nbsp;

Não alterar dados.

&nbsp;

Não alterar snapshot.

&nbsp;

==================================================

18. LOGÍSTICA

==================================================

&nbsp;

Transformar a logística em rodapé compacto.

&nbsp;

Exemplo:

&nbsp;

Entrega • 14/08/2026

&nbsp;

ou:

&nbsp;

Retirada • 14/08/2026

&nbsp;

Pode utilizar ícone existente no design system se já houver.

&nbsp;

Não introduzir estilo destoante apenas nesta seção.

&nbsp;

==================================================

19. REDUZIR ALTURA

==================================================

&nbsp;

Revisar:

&nbsp;

padding

margin

gap

&nbsp;

principalmente:

&nbsp;

- entre Empresa/Data e Produtos;

- entre blocos;

- antes da logística.

&nbsp;

Objetivo:

&nbsp;

reduzir altura do card sem deixar conteúdo apertado.

&nbsp;

==================================================

20. EXEMPLO FINAL

==================================================

&nbsp;

ROMEU 2

&nbsp;

ERP 8666          PED-179AA4

&nbsp;

[ ERP: LIBERADO ]   [ ✓ Enviado ao ERP ]

&nbsp;

GRAAL • 14/08/2026

&nbsp;

┌─────────────────────┐ ┌─────────────────────┐

│ PRODUTOS            │ │ EQUIPAMENTOS        │

│                     │ │                     │

│ 10L CHOPP PILSEN    │ │ 1x CHOPEIRA 1 VIA  │

│                     │ │ 1x BARRIL 10L       │

└─────────────────────┘ └─────────────────────┘

&nbsp;

Entrega • 14/08/2026

&nbsp;

==================================================

21. EXEMPLO MÚLTIPLOS ITENS

==================================================

&nbsp;

PUCCINI ENTRETENIMENTOS LTDA.

&nbsp;

ERP 8658          PED-F98A10

&nbsp;

[ ERP: A ENTREGAR ]   [ ✓ Enviado ao ERP ]

&nbsp;

GRAAL • 14/08/2026

&nbsp;

PRODUTOS

&nbsp;

30L CHOPP PILSEN

10L CHOPP IPA

&nbsp;

EQUIPAMENTOS

&nbsp;

1x BARRIL 30L

1x BARRIL 10L

1x CHOPEIRA 2 VIAS

&nbsp;

Entrega • 14/08/2026

&nbsp;

==================================================

22. PEDIDOS EXCLUÍDOS

==================================================

&nbsp;

Pedido:

&nbsp;

ERP: EXCLUÍDO

&nbsp;

deve utilizar exatamente o mesmo novo layout.

&nbsp;

Não alterar:

&nbsp;

deleted

exists

canEdit

statusDescription

&nbsp;

Somente apresentação.

&nbsp;

==================================================

23. CARD CONTINUA CLICÁVEL

==================================================

&nbsp;

Preservar exatamente:

&nbsp;

onClick

navigate

draftId

route params

&nbsp;

Se o card abre detalhe hoje:

&nbsp;

continua abrindo detalhe da mesma forma.

&nbsp;

==================================================

24. FILTROS

==================================================

&nbsp;

Não alterar filtros existentes.

&nbsp;

Manter:

&nbsp;

Todos

Rascunhos

Aguardando

Aprovados

Enviados

Falhas

Rejeitados

&nbsp;

Nenhuma alteração de regra ou contagem nesta Sprint.

&nbsp;

==================================================

25. PAGINAÇÃO

==================================================

&nbsp;

NÃO implementar paginação nesta Sprint.

&nbsp;

A paginação de:

&nbsp;

10 pedidos por página

&nbsp;

será implementada em Sprint própria posteriormente.

&nbsp;

Não aproveitar esta alteração visual para introduzir:

&nbsp;

range()

count

page state

server-side pagination.

&nbsp;

==================================================

26. IDENTIFICADOR APP

==================================================

&nbsp;

NÃO alterar:

&nbsp;

PED-179AA4

&nbsp;

nesta Sprint.

&nbsp;

A futura alteração para:

&nbsp;

APP-0001

APP-0002

APP-0003

&nbsp;

envolverá persistência e geração sequencial no Supabase e será tratada

separadamente.

&nbsp;

==================================================

27. BACKEND

==================================================

&nbsp;

NODE ALTERADO: NÃO

&nbsp;

Não alterar nenhum arquivo dentro de:

&nbsp;

erp-api/

&nbsp;

==================================================

28. TESTES VISUAIS

==================================================

&nbsp;

Testar card com:

&nbsp;

ERP: LIBERADO

ERP: A ENTREGAR

ERP: EXCLUÍDO

&nbsp;

Também testar:

&nbsp;

- 1 produto / 1 equipamento;

- 1 produto / 2 equipamentos;

- múltiplos produtos;

- múltiplos equipamentos;

- nome de cliente longo.

&nbsp;

==================================================

29. CRITÉRIOS DE ACEITE

==================================================

&nbsp;

Cliente continua como maior destaque:

PASS/FAIL

&nbsp;

ERP visível:

PASS/FAIL

&nbsp;

PED discreto:

PASS/FAIL

&nbsp;

Status ERP antes de Enviado ao ERP:

PASS/FAIL

&nbsp;

Empresa/Data compactos:

PASS/FAIL

&nbsp;

Produtos em bloco próprio:

PASS/FAIL

&nbsp;

Equipamentos em bloco próprio:

PASS/FAIL

&nbsp;

Quantidade aparece antes da descrição:

PASS/FAIL

&nbsp;

Um equipamento por item visual:

PASS/FAIL

&nbsp;

BARRIL 10L preserva "10L":

PASS/FAIL

&nbsp;

Vazão da chopeira pode ser removida visualmente:

PASS/FAIL

&nbsp;

Quebra natural no mobile:

PASS/FAIL

&nbsp;

Sem overflow horizontal:

PASS/FAIL

&nbsp;

Logística compacta:

PASS/FAIL

&nbsp;

Altura do card reduzida:

PASS/FAIL

&nbsp;

==================================================

30. REGRESSÃO OBRIGATÓRIA

==================================================

&nbsp;

Status ERP:

PASS/FAIL

&nbsp;

ERP EXCLUÍDO:

PASS/FAIL

&nbsp;

ERP INDISPONÍVEL:

PASS/FAIL

&nbsp;

Filtros:

PASS/FAIL

&nbsp;

Abertura do detalhe:

PASS/FAIL

&nbsp;

Editar pedido:

PASS/FAIL

&nbsp;

CREATE:

PASS/FAIL

&nbsp;

EDIT:

PASS/FAIL

&nbsp;

Itens/equipamentos:

PASS/FAIL

&nbsp;

Cobertura:

PASS/FAIL

&nbsp;

Pagamento:

PASS/FAIL

&nbsp;

Nenhuma regra de negócio modificada:

PASS/FAIL

&nbsp;

NODE ALTERADO:

NÃO