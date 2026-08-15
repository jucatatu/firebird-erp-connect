# SPRINT 8.9.42.1 — FINALIZAÇÃO DO CADASTRO DE NOVO CLIENTE

&nbsp;

## OBJETIVO

&nbsp;

Aprimorar SOMENTE o frontend do cadastro de cliente direto no ERP, adicionando:

&nbsp;

1. Condição de Pagamento padrão;

2. Forma de Pagamento padrão;

3. Grupo do Cliente obrigatório;

4. Vendedor automático/read-only;

5. Google Maps / Places no endereço;

6. priorização regional de endereços em um raio de 50 km de Jaraguá do Sul/SC;

7. campos de contato/endereço já suportados pelo backend;

8. confirmação visual após cadastrar o cliente;

9. botão separado para iniciar o novo pedido.

&nbsp;

IMPORTANTE:

&nbsp;

Tipo de Venda / Tipo de Operação NÃO pertence ao cadastro do cliente.

&nbsp;

NÃO adicionar Tipo de Venda.

&nbsp;

CLIENTES.ID_OPERACAO deve continuar NULL.

&nbsp;

NODE ALTERADO: NÃO.

&nbsp;

==================================================

1. NÃO ALTERAR O BACKEND

==================================================

&nbsp;

O backend atual já suporta corretamente:

&nbsp;

groupId

sellerId

paymentTermId

paymentMethodId

&nbsp;

Mapeamento existente:

&nbsp;

ID_GRUPO_CLIENTE

← groupId

&nbsp;

ID_VENDEDOR

← sellerId resolvido server-side

&nbsp;

ID_PRAZO

← paymentTermId

&nbsp;

ID_FORMA_PAGAMENTO

← paymentMethodId

&nbsp;

Manter:

&nbsp;

ID_OPERACAO = NULL

ID_TABELA_PRECO = NULL

&nbsp;

NÃO alterar:

&nbsp;

SP_CAD_CLIENTE_COMPLETO

SP_CAD_CONTATOS

ordem dos 34 parâmetros

transação Firebird

duplicidade

CPF_CNPJ

ENDERECO

customer-groups

seller mapping

&nbsp;

==================================================

2. SCHEMA DO FORMULÁRIO

==================================================

&nbsp;

Arquivo principal:

&nbsp;

src/components/client/create-client-form.tsx

&nbsp;

Ajustar:

&nbsp;

name

→ máximo 100 caracteres

&nbsp;

tradeName

→ máximo 100 caracteres

&nbsp;

Adicionar como obrigatórios:

&nbsp;

paymentTermId

paymentMethodId

&nbsp;

Manter obrigatório:

&nbsp;

groupId

mobile

&nbsp;

Adicionar/renderizar:

&nbsp;

phone

→ opcional

&nbsp;

address.zip

→ opcional

&nbsp;

address.complement

→ opcional

&nbsp;

==================================================

3. ORGANIZAÇÃO VISUAL

==================================================

&nbsp;

Organizar o formulário nesta ordem:

&nbsp;

DADOS DO CLIENTE

- Tipo PF/PJ

- Nome / Razão Social

- Nome Fantasia

- CPF/CNPJ

&nbsp;

COMERCIAL

- Grupo do cliente *

- Empresa read-only

- Vendedor automático/read-only

&nbsp;

FINANCEIRO

- Condição de pagamento *

- Forma de pagamento *

&nbsp;

CONTATO

- WhatsApp / Celular *

- Telefone

- E-mail

&nbsp;

ENDEREÇO

- Busca Google Maps

- Rua

- Número

- Bairro

- Cidade

- UF

- CEP

- Complemento

&nbsp;

Layout mobile-first.

&nbsp;

==================================================

4. GRUPO DO CLIENTE

==================================================

&nbsp;

Preservar o campo já existente.

&nbsp;

Usar:

&nbsp;

useErpCustomerGroups()

&nbsp;

Campo obrigatório.

&nbsp;

NÃO hardcodar IDs.

&nbsp;

Exemplo:

&nbsp;

Grupo do cliente *

[ Consumidor Final ▼ ]

&nbsp;

==================================================

5. EMPRESA

==================================================

&nbsp;

Empresa continua sendo determinada pela seleção feita no fluxo de Novo Pedido.

&nbsp;

Exibir apenas como read-only:

&nbsp;

Empresa

GRAAL

&nbsp;

ou:

&nbsp;

Empresa

GROTT

&nbsp;

Não criar segundo seletor de empresa dentro do formulário.

&nbsp;

==================================================

6. VENDEDOR

==================================================

&nbsp;

O vendedor continua sendo resolvido server-side por:

&nbsp;

profiles.erp_seller_id

&nbsp;

→ ID_VENDEDOR

&nbsp;

NÃO criar dropdown.

&nbsp;

No formulário mostrar somente informação visual read-only, se o nome já estiver

disponível:

&nbsp;

Vendedor

Romeu Effting

&nbsp;

ou:

&nbsp;

Vendedor

Automático pelo usuário logado

&nbsp;

Não criar nova lógica apenas para obter o nome.

&nbsp;

==================================================

7. FINANCEIRO

==================================================

&nbsp;

Criar seção:

&nbsp;

FINANCEIRO

&nbsp;

Utilizar:

&nbsp;

useErpPaymentOptions()

&nbsp;

O catálogo pode conter:

&nbsp;

paymentTerms

paymentMethods

saleTypes

&nbsp;

Neste cadastro usar SOMENTE:

&nbsp;

paymentTerms

paymentMethods

&nbsp;

IGNORAR:

&nbsp;

saleTypes

&nbsp;

Tipo de Venda continua pertencendo exclusivamente ao PEDIDO.

&nbsp;

==================================================

8. CONDIÇÃO DE PAGAMENTO

==================================================

&nbsp;

Adicionar:

&nbsp;

Condição de pagamento *

&nbsp;

Popular com:

&nbsp;

paymentTerms

&nbsp;

No submit enviar:

&nbsp;

paymentTermId = Number(valorSelecionado)

&nbsp;

REMOVER qualquer hardcode atual como:

&nbsp;

paymentTermId: 1

&nbsp;

Não selecionar silenciosamente um ID inventado.

&nbsp;

==================================================

9. FORMA DE PAGAMENTO

==================================================

&nbsp;

Adicionar:

&nbsp;

Forma de pagamento *

&nbsp;

Popular com:

&nbsp;

paymentMethods

&nbsp;

No submit:

&nbsp;

paymentMethodId = Number(valorSelecionado)

&nbsp;

REMOVER:

&nbsp;

paymentMethodId: 1

&nbsp;

Não utilizar valor financeiro fixo.

&nbsp;

==================================================

10. FALHA NO CATÁLOGO FINANCEIRO

==================================================

&nbsp;

Durante carregamento:

&nbsp;

mostrar loading discreto.

&nbsp;

Se falhar:

&nbsp;

"Não foi possível carregar as opções financeiras do ERP."

&nbsp;

Não permitir cadastro usando IDs fixos ou inventados.

&nbsp;

==================================================

11. GOOGLE MAPS — REUTILIZAR IMPLEMENTAÇÃO EXISTENTE

==================================================

&nbsp;

O projeto já possui integração Google Maps/Places funcional.

&nbsp;

Reutilizar o padrão existente em:

&nbsp;

src/components/order/delivery-address-section.tsx

&nbsp;

src/lib/google-maps.ts

&nbsp;

Utilizar:

&nbsp;

loadGoogleMapsLibraries()

&nbsp;

AutocompleteSuggestion.fetchAutocompleteSuggestions()

&nbsp;

AutocompleteSessionToken

&nbsp;

prediction.toPlace()

&nbsp;

place.fetchFields()

&nbsp;

NÃO criar uma segunda integração incompatível.

&nbsp;

NÃO utilizar API antiga/deprecated.

&nbsp;

==================================================

12. REGRA REGIONAL — JARAGUÁ DO SUL + 50 KM

==================================================

&nbsp;

Esta regra é OBRIGATÓRIA neste ajuste.

&nbsp;

A busca de endereços deve priorizar fortemente resultados dentro de aproximadamente:

&nbsp;

50 km de Jaraguá do Sul/SC.

&nbsp;

Usar:

&nbsp;

includedRegionCodes: ["br"]

&nbsp;

+

&nbsp;

locationBias

&nbsp;

com centro aproximado em Jaraguá do Sul:

&nbsp;

latitude:

-26.48

&nbsp;

longitude:

-49.07

&nbsp;

raio:

&nbsp;

50000 metros

&nbsp;

Exemplo conceitual:

&nbsp;

locationBias: {

  center: {

    lat: -26.48,

    lng: -49.07

  },

  radius: 50000

}

&nbsp;

Usar a sintaxe exata compatível com a versão da Places API já utilizada pelo

projeto.

&nbsp;

==================================================

13. NÃO USAR RESTRIÇÃO RÍGIDA

==================================================

&nbsp;

NÃO utilizar:

&nbsp;

locationRestriction

&nbsp;

nesta Sprint.

&nbsp;

Queremos PRIORIDADE regional, não bloqueio.

&nbsp;

Um endereço fora dos 50 km ainda deve poder aparecer quando relevante.

&nbsp;

Objetivo:

&nbsp;

ao pesquisar ruas comuns, priorizar:

&nbsp;

Jaraguá do Sul

Guaramirim

Schroeder

Massaranduba

Corupá

e região próxima

&nbsp;

em vez de cidades distantes.

&nbsp;

==================================================

14. BUSCA GOOGLE

==================================================

&nbsp;

Criar campo:

&nbsp;

Buscar endereço

&nbsp;

[ Digite rua, estabelecimento ou endereço... ]

&nbsp;

Começar busca após pelo menos 3 caracteres.

&nbsp;

Debounce:

&nbsp;

aproximadamente 400ms

&nbsp;

Reutilizar o comportamento já comprovado na entrega.

&nbsp;

==================================================

15. AO SELECIONAR ENDEREÇO

==================================================

&nbsp;

Buscar:

&nbsp;

addressComponents

formattedAddress

location

id

displayName

&nbsp;

Preencher:

&nbsp;

route

→ street

&nbsp;

street_number

→ number, se houver

&nbsp;

neighborhood / sublocality

→ district

&nbsp;

locality / administrative_area_level_2

→ city

&nbsp;

administrative_area_level_1

→ state

&nbsp;

postal_code

→ zip

&nbsp;

==================================================

16. UF

==================================================

&nbsp;

Para UF usar:

&nbsp;

shortText

&nbsp;

do componente:

&nbsp;

administrative_area_level_1

&nbsp;

Exemplo:

&nbsp;

Santa Catarina

→ SC

&nbsp;

Nunca enviar:

&nbsp;

"Santa Catarina"

&nbsp;

para address.state.

&nbsp;

O backend espera UF com 2 caracteres.

&nbsp;

==================================================

17. NÚMERO

==================================================

&nbsp;

Número continua sendo campo separado e obrigatório.

&nbsp;

Mesmo se Google preencher street_number:

&nbsp;

o vendedor pode corrigir.

&nbsp;

Se Google não retornar número:

&nbsp;

deixar vazio.

&nbsp;

Não inventar número.

&nbsp;

==================================================

18. GOOGLE É AUXÍLIO, NÃO OBRIGAÇÃO

==================================================

&nbsp;

Todos os campos continuam editáveis manualmente:

&nbsp;

Rua

Número

Bairro

Cidade

UF

CEP

Complemento

&nbsp;

Se Google Maps estiver indisponível:

&nbsp;

o vendedor ainda consegue cadastrar manualmente.

&nbsp;

Não exigir Place ID ou geocodificação para salvar cliente.

&nbsp;

==================================================

19. LATITUDE/LONGITUDE

==================================================

&nbsp;

Embora o Google retorne location:

&nbsp;

NÃO implementar persistência de LATLONG nesta Sprint.

&nbsp;

Backend continua enviando:

&nbsp;

LATLONG = NULL

&nbsp;

Não alterar contrato.

&nbsp;

==================================================

20. CONTATO

==================================================

&nbsp;

Manter:

&nbsp;

WhatsApp / Celular *

obrigatório

&nbsp;

Adicionar:

&nbsp;

Telefone

opcional

&nbsp;

Manter:

&nbsp;

E-mail

opcional

&nbsp;

O backend já possui suporte pela SP_CAD_CONTATOS.

&nbsp;

==================================================

21. CEP E COMPLEMENTO

==================================================

&nbsp;

Renderizar:

&nbsp;

CEP

opcional

&nbsp;

Complemento

opcional

&nbsp;

Google pode preencher CEP automaticamente.

&nbsp;

Vendedor pode corrigir manualmente.

&nbsp;

==================================================

22. PAYLOAD

==================================================

&nbsp;

O submit deve utilizar os valores reais:

&nbsp;

{

  ...dadosCliente,

&nbsp;

  groupId: Number(groupId),

&nbsp;

  paymentTermId: Number(paymentTermId),

&nbsp;

  paymentMethodId: Number(paymentMethodId),

&nbsp;

  address: {

    street,

    number,

    district,

    city,

    state,

    zip,

    complement

  }

}

&nbsp;

NÃO enviar:

&nbsp;

saleTypeId

operationId

ID_OPERACAO

&nbsp;

==================================================

23. BOTÃO

==================================================

&nbsp;

Alterar:

&nbsp;

"Cadastrar e Continuar Pedido"

&nbsp;

para:

&nbsp;

"Cadastrar cliente"

&nbsp;

Durante submit:

&nbsp;

"Salvando no ERP..."

&nbsp;

Desabilitar durante:

&nbsp;

createClient.isPending

&nbsp;

Não permitir duplo clique.

&nbsp;

==================================================

24. NÃO AVANÇAR AUTOMATICAMENTE

==================================================

&nbsp;

Hoje o sucesso avança imediatamente para o pedido.

&nbsp;

Alterar.

&nbsp;

Após criação:

&nbsp;

NÃO executar imediatamente:

&nbsp;

setStep("items")

&nbsp;

Mostrar confirmação:

&nbsp;

✓ CLIENTE CADASTRADO NO ERP

&nbsp;

Nome do cliente

Cliente ERP XXXXX

&nbsp;

[ Gerar novo pedido para este cliente ]

&nbsp;

[ Voltar ]

&nbsp;

==================================================

25. GERAR NOVO PEDIDO

==================================================

&nbsp;

Somente ao tocar:

&nbsp;

Gerar novo pedido para este cliente

&nbsp;

usar a action existente:

&nbsp;

newOrderFromClient(

  createdClient.id,

  createdClient.name,

  companyId

)

&nbsp;

Depois:

&nbsp;

setStep("items")

&nbsp;

Reutilizar essa action.

&nbsp;

NÃO duplicar manualmente a lógica do store.

&nbsp;

==================================================

26. DEFAULTS FINANCEIROS

==================================================

&nbsp;

Após iniciar o pedido para o cliente recém-criado:

&nbsp;

ID_PRAZO cadastrado

→ deve aparecer como condição padrão do pedido.

&nbsp;

ID_FORMA_PAGAMENTO cadastrado

→ deve aparecer como forma padrão do pedido.

&nbsp;

Tipo de Venda continua sendo selecionado exclusivamente na etapa de Pagamento do

PEDIDO.

&nbsp;

Não alterar essa regra.

&nbsp;

==================================================

27. NÃO ALTERAR OUTRAS ÁREAS

==================================================

&nbsp;

NÃO alterar:

&nbsp;

Node

Firebird

procedures

34 parâmetros

CREATE pedido

EDIT pedido

payment flow do pedido

Tipo de Venda do pedido

equipamentos

cobertura

entrega

recolha

Google Maps da entrega

APP-XXXX

paginação

cards

batch-status

status ERP

Supabase schema

&nbsp;

==================================================

28. TESTES

==================================================

&nbsp;

Grupo obrigatório:

PASS/FAIL

&nbsp;

Condição de pagamento:

PASS/FAIL

&nbsp;

Forma de pagamento:

PASS/FAIL

&nbsp;

Hardcode paymentTermId removido:

PASS/FAIL

&nbsp;

Hardcode paymentMethodId removido:

PASS/FAIL

&nbsp;

Tipo de Venda NÃO aparece:

PASS/FAIL

&nbsp;

ID_OPERACAO continua NULL:

PASS/FAIL

&nbsp;

Vendedor automático:

PASS/FAIL

&nbsp;

WhatsApp:

PASS/FAIL

&nbsp;

Telefone:

PASS/FAIL

&nbsp;

Google Places:

PASS/FAIL

&nbsp;

includedRegionCodes BR:

PASS/FAIL

&nbsp;

locationBias Jaraguá do Sul:

PASS/FAIL

&nbsp;

raio 50000 metros:

PASS/FAIL

&nbsp;

locationRestriction NÃO utilizado:

PASS/FAIL

&nbsp;

Rua preenchida:

PASS/FAIL

&nbsp;

Bairro:

PASS/FAIL

&nbsp;

Cidade:

PASS/FAIL

&nbsp;

UF 2 caracteres:

PASS/FAIL

&nbsp;

CEP:

PASS/FAIL

&nbsp;

Número editável:

PASS/FAIL

&nbsp;

Entrada manual sem Google:

PASS/FAIL

&nbsp;

Cadastro ERP:

PASS/FAIL

&nbsp;

Confirmação:

PASS/FAIL

&nbsp;

Gerar novo pedido:

PASS/FAIL

&nbsp;

==================================================

29. REGRESSÃO

==================================================

&nbsp;

Cliente existente:

PASS/FAIL

&nbsp;

Busca cliente:

PASS/FAIL

&nbsp;

CREATE pedido:

PASS/FAIL

&nbsp;

EDIT pedido:

PASS/FAIL

&nbsp;

Pagamento pedido:

PASS/FAIL

&nbsp;

Tipo Venda pedido:

PASS/FAIL

&nbsp;

Google Maps entrega:

PASS/FAIL

&nbsp;

Equipamentos:

PASS/FAIL

&nbsp;

APP-XXXX:

PASS/FAIL

&nbsp;

Paginação:

PASS/FAIL

&nbsp;

==================================================

30. RELATÓRIO FINAL

==================================================

&nbsp;

ARQUIVOS ALTERADOS:

&nbsp;

FINANCEIRO ADICIONADO:

SIM/NÃO

&nbsp;

GRUPO PRESERVADO:

SIM/NÃO

&nbsp;

VENDEDOR AUTOMÁTICO:

SIM/NÃO

&nbsp;

paymentTermId HARDCODE:

REMOVIDO / NÃO

&nbsp;

paymentMethodId HARDCODE:

REMOVIDO / NÃO

&nbsp;

TIPO DE VENDA NO CLIENTE:

NÃO

&nbsp;

ID_OPERACAO:

NULL

&nbsp;

GOOGLE PLACES:

SIM/NÃO

&nbsp;

LOCATION BIAS:

JARAGUÁ DO SUL / 50 KM

&nbsp;

LOCATION RESTRICTION:

NÃO

&nbsp;

TELEFONE:

SIM/NÃO

&nbsp;

CEP:

SIM/NÃO

&nbsp;

COMPLEMENTO:

SIM/NÃO

&nbsp;

CONFIRMAÇÃO PÓS-CADASTRO:

SIM/NÃO

&nbsp;

newOrderFromClient:

REUTILIZADO SIM/NÃO

&nbsp;

NODE ALTERADO:

NÃO

&nbsp;

REGRESSÕES: