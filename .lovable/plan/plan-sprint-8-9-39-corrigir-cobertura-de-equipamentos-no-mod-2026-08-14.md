# PLAN — SPRINT 8.9.39 — CORRIGIR COBERTURA DE EQUIPAMENTOS NO MODO EDIÇÃO

&nbsp;

## Objetivo

&nbsp;

Corrigir exclusivamente o modo de EDIÇÃO de pedidos existentes, onde os equipamentos são carregados corretamente do ERP, porém a cobertura de barris não é reconhecida.

&nbsp;

Cenário real atual:

&nbsp;

CHOPP PILSEN

10 L

&nbsp;

Equipamentos:

&nbsp;

CHOPEIRA ELÉTRICA 1 VIA 30L/H

Qtd: 1

&nbsp;

BARRIL 10L

Qtd: 1

&nbsp;

Porém a cobertura mostra:

&nbsp;

0 / 10 L

Faltam 10L

&nbsp;

O resultado correto deve ser:

&nbsp;

10 / 10 L

COBERTO

&nbsp;

IMPORTANTE:

&nbsp;

O fluxo de NOVO PEDIDO está funcional e deve permanecer congelado nesta Sprint.

&nbsp;

NÃO ALTERAR:

&nbsp;

- CREATE;

- sugestão de equipamentos do CREATE;

- Google Maps;

- endereço/logística;

- pagamento;

- Node ERP;

- regras de cobertura homologadas.

&nbsp;

Não liberar navegação ignorando cobertura inválida.

&nbsp;

==================================================

1. PRINCÍPIO DA CORREÇÃO

==================================================

&nbsp;

O CREATE atualmente funciona.

&nbsp;

Portanto o objeto interno produzido pelo CREATE será considerado o contrato

de referência.

&nbsp;

O objetivo da Sprint é fazer os equipamentos carregados no EDIT serem

NORMALIZADOS para o mesmo formato operacional usado no CREATE.

&nbsp;

Não criar uma segunda regra de cobertura para edição.

&nbsp;

Não enfraquecer:

&nbsp;

getProductCoverage()

isCoverageValid()

&nbsp;

Corrigir a entrada de dados do EDIT.

&nbsp;

==================================================

2. STORE DE PEDIDOS

==================================================

&nbsp;

Arquivo principal:

&nbsp;

src/hooks/use-order-form.ts

&nbsp;

A função:

&nbsp;

editErpOrder(...)

&nbsp;

deve continuar responsável pela hidratação base dos dados retornados pelo ERP.

&nbsp;

Não colocar nela lógica complexa dependente de catálogo assíncrono.

&nbsp;

Registrar temporariamente:

&nbsp;

[EDIT EQUIPMENT] ERP raw equipments

&nbsp;

Para cada equipamento:

&nbsp;

{

  equipmentTypeId,

  description,

  quantity,

  assignedProductId,

  role,

  capacityLiters,

  tapLines

}

&nbsp;

Registrar também:

&nbsp;

[EDIT EQUIPMENT] items

&nbsp;

{

  productId,

  description,

  quantity,

  logisticsType

}

&nbsp;

Objetivo:

&nbsp;

identificar exatamente quais metadados não existem no retorno bruto do ERP.

&nbsp;

==================================================

3. FONTE OFICIAL DOS DADOS

==================================================

&nbsp;

ERP continua sendo fonte oficial para:

&nbsp;

- itens;

- quantidades;

- preços;

- equipmentTypeId;

- quantidade de equipamentos;

- dados atuais do pedido.

&nbsp;

Snapshot operacional pode ser usado APENAS como fonte auxiliar para metadados

que não existem no ERP, como:

&nbsp;

- assignedProductId;

- role;

- capacityLiters;

- tapLines.

&nbsp;

Não substituir dados oficiais do ERP pelos valores do snapshot.

&nbsp;

==================================================

4. CATÁLOGO DE EQUIPAMENTOS

==================================================

&nbsp;

Utilizar:

&nbsp;

useErpEquipmentTypes

equipmentTypesQ.data

&nbsp;

como fonte da verdade para metadados operacionais do tipo de equipamento.

&nbsp;

Para cada equipmentTypeId do pedido:

&nbsp;

localizar o respectivo tipo no catálogo.

&nbsp;

Completar:

&nbsp;

role

capacityLiters

tapLines

&nbsp;

Exemplo:

&nbsp;

BARRIL 10L

&nbsp;

deve resultar em algo equivalente a:

&nbsp;

{

  role: "KEG",

  capacityLiters: 10

}

&nbsp;

CHOPEIRA ELÉTRICA 1 VIA 30L/H

&nbsp;

deve resultar em algo equivalente a:

&nbsp;

{

  role: "TAP",

  tapLines: 1

}

&nbsp;

IMPORTANTE:

&nbsp;

"30L/H" da chopeira é vazão.

&nbsp;

Nunca considerar isso como capacidade de barril.

&nbsp;

Somente KEG/BARRIL fornece litros de cobertura.

&nbsp;

==================================================

5. assignedProductId

==================================================

&nbsp;

A cobertura continua sendo POR PRODUTO.

&nbsp;

Todo barril utilizado na cobertura precisa estar associado ao produto correto.

&nbsp;

Prioridades obrigatórias:

&nbsp;

PRIORIDADE 1

&nbsp;

Se o snapshot operacional possui:

&nbsp;

assignedProductId

&nbsp;

preservar essa associação.

&nbsp;

PRIORIDADE 2

&nbsp;

Se existir somente UM produto no pedido que exige barril/chopp:

&nbsp;

associar automaticamente todos os equipamentos:

&nbsp;

role = KEG

&nbsp;

a esse único produto.

&nbsp;

Exemplo:

&nbsp;

CHOPP PILSEN

productId = 123

quantity = 10L

&nbsp;

BARRIL 10L

quantity = 1

&nbsp;

Resultado:

&nbsp;

assignedProductId = 123

role = KEG

capacityLiters = 10

&nbsp;

Cobertura:

&nbsp;

10 / 10 L

&nbsp;

PRIORIDADE 3

&nbsp;

Se houver mais de um produto chopp e não existir informação suficiente para

reconstruir a associação:

&nbsp;

NÃO inventar associação.

&nbsp;

Manter como não associado e mostrar:

&nbsp;

"Revise a associação dos barris aos produtos."

&nbsp;

Permitir ajuste manual.

&nbsp;

==================================================

6. NORMALIZAÇÃO NO WIZARD

==================================================

&nbsp;

Arquivo principal:

&nbsp;

src/routes/_authenticated.pedidos-venda.novo.tsx

&nbsp;

Implementar normalização especializada para:

&nbsp;

isEditing === true

&nbsp;

A normalização só pode executar quando TODOS estes dados estiverem disponíveis:

&nbsp;

- pedido ERP hidratado;

- items carregados;

- equipments carregados;

- equipmentTypesQ.data carregado;

- snapshot operacional carregado, quando houver.

&nbsp;

Não executar normalização parcial.

&nbsp;

==================================================

7. ORDEM OBRIGATÓRIA DE HIDRATAÇÃO

==================================================

&nbsp;

Fluxo:

&nbsp;

GET pedido ERP

↓

hidratação base

↓

items disponíveis

↓

equipments disponíveis

↓

catálogo disponível

↓

snapshot operacional disponível

↓

normalizar equipamentos

↓

reconstruir assignedProductId

↓

validar cobertura

↓

liberar Wizard

&nbsp;

A primeira renderização útil da tela de edição deve preferencialmente já

mostrar:

&nbsp;

10 / 10 L

&nbsp;

e não:

&nbsp;

0 / 10 L

↓

10 / 10 L

&nbsp;

Evitar flicker de estado inválido.

&nbsp;

==================================================

8. GATE DE RENDERIZAÇÃO

==================================================

&nbsp;

O Gate do EDIT deve permanecer ativo até a normalização logística terminar.

&nbsp;

Não liberar o Wizard enquanto ainda existir equipamento do ERP esperando

enriquecimento obrigatório do catálogo.

&nbsp;

O Gate deve cobrir:

&nbsp;

ERP hydration

+

catalog availability

+

snapshot availability

+

equipment normalization

&nbsp;

Somente depois:

&nbsp;

renderizar Itens + Equipamentos.

&nbsp;

==================================================

9. EVITAR LOOP DE useEffect

==================================================

&nbsp;

Muito importante:

&nbsp;

Não criar:

&nbsp;

useEffect

→ setEquipments

→ render

→ useEffect

→ setEquipments

→ ...

&nbsp;

Antes de atualizar a store, comparar equipamento atual com equipamento

normalizado.

&nbsp;

Somente executar setState/setEquipments quando houver diferença real em:

&nbsp;

- role;

- capacityLiters;

- tapLines;

- assignedProductId.

&nbsp;

Não alterar:

&nbsp;

- equipmentTypeId;

- quantity;

&nbsp;

durante a normalização.

&nbsp;

==================================================

10. NÃO USAR suggestEquipments NA HIDRATAÇÃO

==================================================

&nbsp;

Não chamar:

&nbsp;

suggestEquipments()

&nbsp;

automaticamente ao abrir edição.

&nbsp;

O pedido já possui equipamentos reais no ERP.

&nbsp;

Objetivo:

&nbsp;

NORMALIZAR OS EQUIPAMENTOS EXISTENTES.

&nbsp;

Não:

&nbsp;

GERAR NOVA SUGESTÃO.

&nbsp;

Exemplo:

&nbsp;

ERP possui:

&nbsp;

CHOPEIRA x1

BARRIL 10L x1

&nbsp;

A edição deve continuar exatamente com:

&nbsp;

CHOPEIRA x1

BARRIL 10L x1

&nbsp;

apenas enriquecidos com os metadados necessários.

&nbsp;

==================================================

11. UMA ÚNICA COLEÇÃO DE EQUIPAMENTOS

==================================================

&nbsp;

Depois da normalização, os equipamentos normalizados devem voltar para a

MESMA store utilizada pela interface.

&nbsp;

Não criar:

&nbsp;

rawEquipments

normalizedEquipments

coverageEquipments

&nbsp;

como fontes concorrentes de verdade.

&nbsp;

A fonte final deve continuar sendo:

&nbsp;

useOrderFormStore().equipments

&nbsp;

Essa mesma coleção alimenta:

&nbsp;

- lista de equipamentos;

- cobertura;

- resumo do pedido;

- navegação;

- salvamento.

&nbsp;

==================================================

12. COBERTURA

==================================================

&nbsp;

Preservar a regra atual.

&nbsp;

Conceitualmente:

&nbsp;

para cada produto chopp:

&nbsp;

required =

litros do produto

&nbsp;

provided =

somatório de:

&nbsp;

capacityLiters

×

quantity

&nbsp;

somente dos equipamentos:

&nbsp;

role = KEG

&nbsp;

e:

&nbsp;

assignedProductId === productId

&nbsp;

Chopeiras TAP não entram na soma de litros.

&nbsp;

==================================================

13. REATIVIDADE

==================================================

&nbsp;

Auditar se:

&nbsp;

getProductCoverage

isCoverageValid

CoverageSummary

Resumo do Pedido

Próximo

Swipe

Tabs

&nbsp;

reagem automaticamente às alterações da store.

&nbsp;

Evitar usar:

&nbsp;

useOrderFormStore.getState()

&nbsp;

em componentes que dependem de re-render.

&nbsp;

Se equipments mudar:

&nbsp;

a cobertura deve mudar automaticamente.

&nbsp;

==================================================

14. CENÁRIO PRINCIPAL

==================================================

&nbsp;

Abrir pedido existente contendo:

&nbsp;

CHOPP PILSEN

10L

&nbsp;

Equipamentos:

&nbsp;

CHOPEIRA ELÉTRICA 1 VIA 30L/H

Qtd 1

&nbsp;

BARRIL 10L

Qtd 1

&nbsp;

Sem tocar em:

&nbsp;

Recalcular sugestão

&nbsp;

Resultado obrigatório após hidratação:

&nbsp;

CHOPP PILSEN

10 / 10 L

COBERTO

&nbsp;

Resumo:

&nbsp;

Barris suficientes

&nbsp;

Próximo:

HABILITADO

&nbsp;

Swipe:

HABILITADO

&nbsp;

Aba Entrega:

HABILITADA

&nbsp;

==================================================

15. TESTE DINÂMICO DE PRODUTO

==================================================

&nbsp;

Ainda na edição:

&nbsp;

Pilsen 10L

BARRIL 10L

&nbsp;

Resultado inicial:

&nbsp;

10 / 10

&nbsp;

Alterar:

&nbsp;

10L → 20L

&nbsp;

Resultado imediato:

&nbsp;

10 / 20

Faltam 10L

&nbsp;

Voltar:

&nbsp;

20L → 10L

&nbsp;

Resultado imediato:

&nbsp;

10 / 10

Coberto

&nbsp;

Não exigir reload.

&nbsp;

Não exigir Recalcular sugestão para atualizar apenas a cobertura.

&nbsp;

==================================================

16. TESTE DINÂMICO DE EQUIPAMENTO

==================================================

&nbsp;

Pilsen 10L

BARRIL 10L x1

&nbsp;

Resultado:

&nbsp;

10 / 10

&nbsp;

Remover barril:

&nbsp;

0 / 10

&nbsp;

Adicionar novamente:

&nbsp;

10 / 10

&nbsp;

A cobertura deve reagir imediatamente.

&nbsp;

==================================================

17. NAVEGAÇÃO

==================================================

&nbsp;

Não alterar os guards homologados.

&nbsp;

Quando cobertura:

&nbsp;

0 / 10

&nbsp;

bloquear:

&nbsp;

- Próximo;

- swipe;

- aba Entrega.

&nbsp;

Quando cobertura:

&nbsp;

10 / 10

&nbsp;

liberar automaticamente os três.

&nbsp;

Todos devem continuar usando a mesma:

&nbsp;

isCoverageValid()

&nbsp;

==================================================

18. PEDIDOS COM MAIS DE UM CHOPP

==================================================

&nbsp;

Testar também cenário com:

&nbsp;

Pilsen 10L

IPA 20L

&nbsp;

Se o snapshot possuir associações históricas:

&nbsp;

restaurar cada assignedProductId.

&nbsp;

Se não possuir e houver ambiguidade:

&nbsp;

NÃO somar barris globalmente.

&nbsp;

NÃO associar todos ao primeiro produto.

&nbsp;

Mostrar revisão manual.

&nbsp;

Cobertura deve permanecer específica por produto.

&nbsp;

==================================================

19. CREATE CONGELADO

==================================================

&nbsp;

Depois da correção do EDIT:

&nbsp;

executar somente teste de regressão no CREATE.

&nbsp;

Novo Pedido:

&nbsp;

CHOPP PILSEN 10L

BARRIL 10L

&nbsp;

Esperado:

&nbsp;

10 / 10

&nbsp;

Não refatorar CREATE nesta Sprint apenas para compartilhar código.

&nbsp;

O CREATE funcional atual é referência.

&nbsp;

==================================================

20. NODE

==================================================

&nbsp;

Inicialmente:

&nbsp;

NODE ALTERADO: NÃO

&nbsp;

Não alterar backend para fornecer metadados que já podem ser reconstruídos

com:

&nbsp;

- ERP;

- catálogo;

- snapshot operacional.

&nbsp;

Se durante a auditoria surgir um campo absolutamente necessário que não exista

em nenhuma dessas três fontes:

&nbsp;

PARAR.

&nbsp;

Relatar:

&nbsp;

NODE ALTERADO: NECESSÁRIO

&nbsp;

Campo ausente:

________________

&nbsp;

Endpoint afetado:

________________

&nbsp;

Motivo:

________________

&nbsp;

Aguardar aprovação antes de alterar Node.

&nbsp;

==================================================

21. LOGS TEMPORÁRIOS

==================================================

&nbsp;

Durante desenvolvimento registrar:

&nbsp;

[EDIT EQUIPMENT] ERP raw equipments

&nbsp;

[EDIT EQUIPMENT] catalog ready

&nbsp;

[EDIT EQUIPMENT] snapshot ready

&nbsp;

[EDIT EQUIPMENT] normalizing

&nbsp;

[EDIT EQUIPMENT] normalized equipments

&nbsp;

[EDIT EQUIPMENT] coverage after normalization

&nbsp;

Exemplo esperado:

&nbsp;

ERP raw:

&nbsp;

BARRIL 10L

equipmentTypeId = X

quantity = 1

role = undefined

capacityLiters = undefined

assignedProductId = null

&nbsp;

Depois:

&nbsp;

BARRIL 10L

equipmentTypeId = X

quantity = 1

role = KEG

capacityLiters = 10

assignedProductId = <Pilsen productId>

&nbsp;

Coverage:

&nbsp;

provided = 10

required = 10

&nbsp;

==================================================

22. NÃO DECLARAR PASS APENAS PELA UI

==================================================

&nbsp;

O relatório deve provar os valores internos.

&nbsp;

Não basta dizer:

&nbsp;

"Cobertura corrigida."

&nbsp;

Informar:

&nbsp;

productId

equipmentTypeId

role

capacityLiters

assignedProductId

required

provided

&nbsp;

==================================================

CRITÉRIOS DE ACEITE

==================================================

&nbsp;

- pedido editado abre com cobertura correta;

- equipamento existente no ERP é preservado;

- KEG recebe metadados do catálogo;

- assignedProductId é restaurado/reconstruído corretamente;

- cobertura por produto permanece;

- chopeira não fornece litros;

- nenhuma sugestão nova é gerada automaticamente;

- nenhuma piscada 0/10 antes de 10/10;

- nenhum loop de useEffect;

- navegação reage à cobertura;

- CREATE permanece intacto;

- Node permanece intacto.

&nbsp;

==================================================

RELATÓRIO FINAL OBRIGATÓRIO

==================================================

&nbsp;

SPRINT 8.9.39

&nbsp;

PEDIDO EDIT TESTADO:

________________

&nbsp;

ITEM

&nbsp;

Produto:

________________

&nbsp;

productId:

________________

&nbsp;

Quantidade:

______ L

&nbsp;

&nbsp;

EQUIPAMENTO ERP

&nbsp;

Descrição:

________________

&nbsp;

equipmentTypeId:

________________

&nbsp;

quantity:

________________

&nbsp;

&nbsp;

ANTES DA NORMALIZAÇÃO

&nbsp;

role:

________________

&nbsp;

capacityLiters:

________________

&nbsp;

tapLines:

________________

&nbsp;

assignedProductId:

________________

&nbsp;

&nbsp;

DEPOIS DA NORMALIZAÇÃO

&nbsp;

role:

________________

&nbsp;

capacityLiters:

________________

&nbsp;

tapLines:

________________

&nbsp;

assignedProductId:

________________

&nbsp;

&nbsp;

NORMALIZAÇÃO

&nbsp;

Catálogo estava disponível antes da normalização:

PASS/FAIL

&nbsp;

Snapshot estava disponível antes da normalização:

PASS/FAIL

&nbsp;

Normalização executou somente quando pronta:

PASS/FAIL

&nbsp;

Loop de useEffect inexistente:

PASS/FAIL

&nbsp;

Primeiro render útil já mostrou cobertura correta:

PASS/FAIL

&nbsp;

suggestEquipments NÃO foi chamado durante hidratação:

PASS/FAIL

&nbsp;

&nbsp;

COBERTURA

&nbsp;

required:

______ L

&nbsp;

provided:

______ L

&nbsp;

Resultado:

______ / ______ L

&nbsp;

isCoverageValid:

TRUE/FALSE

&nbsp;

&nbsp;

NAVEGAÇÃO

&nbsp;

Próximo:

PASS/FAIL

&nbsp;

Swipe:

PASS/FAIL

&nbsp;

Aba Entrega:

PASS/FAIL

&nbsp;

&nbsp;

REATIVIDADE

&nbsp;

10L → 20L:

PASS/FAIL

&nbsp;

20L → 10L:

PASS/FAIL

&nbsp;

Remover barril:

PASS/FAIL

&nbsp;

Adicionar barril:

PASS/FAIL

&nbsp;

&nbsp;

MÚLTIPLOS CHOPPS

&nbsp;

Associação por produto preservada:

PASS/FAIL

&nbsp;

Nenhuma associação inventada:

PASS/FAIL

&nbsp;

&nbsp;

REGRESSÃO

&nbsp;

CREATE permaneceu funcional:

PASS/FAIL

&nbsp;

Cobertura CREATE:

PASS/FAIL

&nbsp;

&nbsp;

NODE ALTERADO:

NÃO