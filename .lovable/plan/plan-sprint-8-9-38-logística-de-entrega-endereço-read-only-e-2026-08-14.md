PLAN — SPRINT 8.9.38 — LOGÍSTICA DE ENTREGA, ENDEREÇO READ ONLY E CORREÇÃO DO SALVAMENTO

&nbsp;

Objetivo

&nbsp;

Corrigir definitivamente o fluxo da etapa logística do Wizard de Pedidos e restaurar o salvamento dos pedidos.

&nbsp;

A nova regra deve separar claramente:

&nbsp;

1. ENTREGA

2. RETIRADA

3. endereço cadastral do cliente;

4. endereço personalizado para aquele pedido;

5. Google Maps apenas quando realmente necessário.

&nbsp;

Também deve ser diagnosticado e corrigido o motivo pelo qual o pedido deixou de ser salvo após a implementação dos novos dados de endereço.

&nbsp;

---

&nbsp;

1. REGRA DE NEGÓCIO DEFINITIVA

&nbsp;

Ao entrar na etapa logística, a primeira decisão deve ser:

&nbsp;

COMO O CLIENTE RECEBERÁ O PEDIDO?

&nbsp;

[ ENTREGA ]

&nbsp;

[ RETIRADA ]

&nbsp;

Não mostrar nem focar automaticamente o endereço antes dessa escolha.

&nbsp;

---

&nbsp;

2. RETIRADA

&nbsp;

Quando o vendedor escolher:

&nbsp;

RETIRADA

&nbsp;

definir:

&nbsp;

deliver = false

&nbsp;

Nesse modo:

&nbsp;

- não mostrar endereço de entrega;

- não carregar Google Places;

- não carregar mapa;

- não exigir latitude/longitude;

- não exigir confirmação de endereço;

- endereço não pode bloquear a navegação;

- permitir seguir normalmente para Pagamento.

&nbsp;

---

&nbsp;

3. ENTREGA

&nbsp;

Quando o vendedor escolher:

&nbsp;

ENTREGA

&nbsp;

definir:

&nbsp;

deliver = true

&nbsp;

Somente então mostrar a seção:

&nbsp;

ENDEREÇO DE ENTREGA

&nbsp;

---

&nbsp;

4. ENDEREÇO CADASTRAL DO CLIENTE

&nbsp;

Se o cliente já possui endereço cadastrado suficiente para entrega, utilizar esse endereço automaticamente.

&nbsp;

Exemplo:

&nbsp;

R ROBERTO ZIEMANN, 1963

AMIZADE

JARAGUÁ DO SUL - SC

&nbsp;

Esse endereço deverá aparecer:

&nbsp;

- preenchido;

- em modo READ ONLY;

- sem abrir teclado;

- sem Google Maps;

- sem exigir geocodificação;

- sem exigir nova confirmação.

&nbsp;

Mostrar identificação discreta:

&nbsp;

Endereço do cadastro do cliente

&nbsp;

e ação:

&nbsp;

[ ALTERAR ENDEREÇO ]

&nbsp;

---

&nbsp;

5. NÃO EXIGIR CONFIRMAÇÃO PARA ENDEREÇO CADASTRAL

&nbsp;

Nova regra:

&nbsp;

Se:

&nbsp;

deliveryAddressSource === "client"

&nbsp;

e o endereço cadastral estiver completo, o pedido já possui endereço válido.

&nbsp;

Não exigir:

&nbsp;

deliveryAddressConfirmed === true

&nbsp;

Não exigir Google.

&nbsp;

Não exigir mapa.

&nbsp;

Não exigir coordenadas.

&nbsp;

O vendedor pode seguir normalmente.

&nbsp;

---

&nbsp;

6. ORIGEM DO ENDEREÇO

&nbsp;

Adicionar estado explícito:

&nbsp;

deliveryAddressSource: "client" | "custom"

&nbsp;

CLIENT

&nbsp;

deliveryAddressSource = "client"

&nbsp;

Significa:

&nbsp;

o pedido está utilizando exatamente o endereço cadastral do cliente.

&nbsp;

Comportamento:

&nbsp;

- read only;

- sem confirmação adicional;

- sem Google obrigatório;

- sem geocodificação obrigatória.

&nbsp;

CUSTOM

&nbsp;

deliveryAddressSource = "custom"

&nbsp;

Significa:

&nbsp;

o vendedor decidiu utilizar outro endereço somente para aquele pedido.

&nbsp;

Comportamento:

&nbsp;

- campos editáveis;

- Google Places disponível;

- geocodificação disponível;

- confirmação obrigatória antes de avançar.

&nbsp;

---

&nbsp;

7. BOTÃO ALTERAR ENDEREÇO

&nbsp;

Quando estiver usando o endereço cadastral, mostrar:

&nbsp;

[ ALTERAR ENDEREÇO ]

&nbsp;

Ao clicar:

&nbsp;

deliveryAddressSource = "custom"

deliveryAddressConfirmed = false

&nbsp;

Criar uma cópia editável do endereço atual.

&nbsp;

Não alterar o cadastro do cliente.

&nbsp;

---

&nbsp;

8. FORMULÁRIO DO ENDEREÇO CUSTOM

&nbsp;

Depois de clicar em Alterar Endereço, mostrar:

&nbsp;

LOGRADOURO

[ Pesquisar rua ]

&nbsp;

NÚMERO

[ ______ ]

&nbsp;

[ ] Sem número

&nbsp;

BAIRRO

[ ______ ]

&nbsp;

CIDADE

[ ______ ]

&nbsp;

UF

[ __ ]

&nbsp;

CEP

[ ______ ]

&nbsp;

COMPLEMENTO

[ ______ ]

&nbsp;

PONTO DE REFERÊNCIA

[ ______ ]

&nbsp;

No mobile:

&nbsp;

- priorizar um campo por linha;

- evitar campos excessivamente comprimidos;

- manter Número claramente separado do Logradouro.

&nbsp;

---

&nbsp;

9. GOOGLE PLACES

&nbsp;

Google deve atuar somente como assistente do campo:

&nbsp;

LOGRADOURO

&nbsp;

Usar a integração já existente:

&nbsp;

Google Maps → Managed by Lovable

&nbsp;

com:

&nbsp;

Autocomplete Data API (New)

&nbsp;

Não voltar ao autocomplete Legacy.

&nbsp;

Manter:

&nbsp;

includedRegionCodes = ["br"]

&nbsp;

e "locationBias" regional sem restringir o usuário a Jaraguá do Sul.

&nbsp;

---

&nbsp;

10. SELEÇÃO DE RUA

&nbsp;

Ao selecionar uma sugestão Google:

&nbsp;

usar:

&nbsp;

prediction.toPlace()

&nbsp;

seguido de:

&nbsp;

place.fetchFields(...)

&nbsp;

para obter:

&nbsp;

addressComponents

formattedAddress

location

id

&nbsp;

Preencher:

&nbsp;

Logradouro

Bairro

Cidade

UF

CEP

&nbsp;

Se Google não fornecer "street_number":

&nbsp;

Número = vazio

&nbsp;

e mover automaticamente o foco para:

&nbsp;

NÚMERO

&nbsp;

---

&nbsp;

11. NÚMERO

&nbsp;

Número deve ser um campo próprio.

&nbsp;

Não depender do Google para obtê-lo.

&nbsp;

Se o usuário marcar:

&nbsp;

Sem número

&nbsp;

salvar:

&nbsp;

S/N

&nbsp;

e tornar:

&nbsp;

Ponto de referência

&nbsp;

obrigatório.

&nbsp;

---

&nbsp;

12. ALTERAÇÃO INVALIDA CONFIRMAÇÃO

&nbsp;

Se endereço custom já estiver confirmado e o vendedor alterar:

&nbsp;

- Logradouro;

- Número;

- Bairro;

- Cidade;

- UF;

- CEP;

&nbsp;

definir imediatamente:

&nbsp;

deliveryAddressConfirmed = false

&nbsp;

Quando alterar rua ou número, invalidar também coordenadas antigas quando necessário.

&nbsp;

Nunca manter coordenadas correspondentes a outro endereço.

&nbsp;

---

&nbsp;

13. GEOCODIFICAÇÃO

&nbsp;

Somente para endereço custom.

&nbsp;

Depois de possuir:

&nbsp;

Rua

Número

Cidade

UF

&nbsp;

tentar geocodificar pelo Google Maps Connector server-side.

&nbsp;

Não usar o ERP Node para geocodificação.

&nbsp;

Não criar rota "/api/v1/map/geocode-address".

&nbsp;

Não utilizar a browser key diretamente em endpoint server-side.

&nbsp;

Resultado esperado:

&nbsp;

{

  latitude,

  longitude,

  formattedAddress,

  placeId

}

&nbsp;

---

&nbsp;

14. MAPA

&nbsp;

Mostrar mapa apenas quando existirem coordenadas válidas.

&nbsp;

Não carregar mapa ao entrar na etapa Entrega.

&nbsp;

Não carregar mapa em Retirada.

&nbsp;

Não carregar mapa apenas porque existe endereço cadastral.

&nbsp;

Mapa é um recurso complementar para endereço customizado.

&nbsp;

---

&nbsp;

15. GOOGLE NÃO PODE BLOQUEAR A VENDA

&nbsp;

Se Google Maps ou geocodificação estiver indisponível:

&nbsp;

permitir preenchimento manual.

&nbsp;

O vendedor poderá confirmar o endereço custom manualmente.

&nbsp;

Nesse caso registrar:

&nbsp;

Endereço confirmado sem coordenadas

&nbsp;

Nunca inventar latitude/longitude.

&nbsp;

---

&nbsp;

16. CONFIRMAÇÃO

&nbsp;

A confirmação obrigatória passa a valer somente quando:

&nbsp;

deliveryAddressSource === "custom"

&nbsp;

Nesse caso:

&nbsp;

deliveryAddressConfirmed === true

&nbsp;

é obrigatório para avançar.

&nbsp;

Quando:

&nbsp;

deliveryAddressSource === "client"

&nbsp;

e o endereço cadastral for válido:

&nbsp;

não exigir confirmação.

&nbsp;

---

&nbsp;

17. REGRA CENTRALIZADA DE VALIDAÇÃO

&nbsp;

Criar uma única regra utilizada por:

&nbsp;

- botão Próximo;

- swipe;

- clique nas abas;

- revisão;

- finalização.

&nbsp;

Exemplo conceitual:

&nbsp;

function isDeliveryAddressValid() {

  if (!deliver) {

    return true;

  }

&nbsp;

  if (

    deliveryAddressSource === "client" &&

    hasValidClientAddress

  ) {

    return true;

  }

&nbsp;

  if (

    deliveryAddressSource === "custom" &&

    deliveryAddressConfirmed === true

  ) {

    return true;

  }

&nbsp;

  return false;

}

&nbsp;

Não duplicar regras diferentes em vários componentes.

&nbsp;

---

&nbsp;

18. ENDEREÇO CADASTRAL INCOMPLETO

&nbsp;

Considerar endereço cadastral utilizável quando possuir no mínimo:

&nbsp;

Logradouro

Número ou S/N

Cidade

UF

&nbsp;

Se estiver incompleto:

&nbsp;

mostrar:

&nbsp;

O cadastro do cliente não possui endereço completo para entrega.

&nbsp;

[ INFORMAR ENDEREÇO DE ENTREGA ]

&nbsp;

Ao clicar:

&nbsp;

deliveryAddressSource = "custom"

deliveryAddressConfirmed = false

&nbsp;

Abrir o formulário editável.

&nbsp;

---

&nbsp;

19. VOLTAR AO ENDEREÇO CADASTRAL

&nbsp;

Enquanto estiver usando endereço custom, disponibilizar:

&nbsp;

[ USAR ENDEREÇO DO CADASTRO ]

&nbsp;

se existir endereço cadastral válido.

&nbsp;

Ao clicar:

&nbsp;

deliveryAddressSource = "client"

deliveryAddressConfirmed = false

&nbsp;

Restaurar endereço cadastral.

&nbsp;

Voltar para read only.

&nbsp;

Permitir avanço imediatamente.

&nbsp;

---

&nbsp;

20. ENDEREÇO NÃO ALTERA CADASTRO DO CLIENTE

&nbsp;

Regra absoluta:

&nbsp;

alterações realizadas na etapa Entrega pertencem somente ao pedido.

&nbsp;

Nunca atualizar automaticamente:

&nbsp;

CLIENTES

PESSOAS

RUA

BAIRRO

CIDADE

&nbsp;

ou qualquer informação cadastral do cliente no Firebird.

&nbsp;

---

&nbsp;

21. SNAPSHOT DO PEDIDO

&nbsp;

Salvar no snapshot operacional:

&nbsp;

deliveryAddressSource

deliveryAddress

deliveryAddressConfirmed

&nbsp;

Exemplo usando cadastro:

&nbsp;

{

  "deliveryAddressSource": "client",

  "deliveryAddress": {

    "street": "R ROBERTO ZIEMANN",

    "number": "1963",

    "neighborhood": "AMIZADE",

    "city": "JARAGUA DO SUL",

    "state": "SC"

  }

}

&nbsp;

Exemplo custom:

&nbsp;

{

  "deliveryAddressSource": "custom",

  "deliveryAddressConfirmed": true,

  "deliveryAddress": {

    "street": "Rua Exemplo",

    "number": "100",

    "neighborhood": "Centro",

    "city": "Jaraguá do Sul",

    "state": "SC",

    "postalCode": "89200-000",

    "latitude": -26.48,

    "longitude": -49.07,

    "placeId": "..."

  }

}

&nbsp;

---

&nbsp;

22. EDIÇÃO DE PEDIDO

&nbsp;

No modo EDIT:

&nbsp;

prioridade absoluta:

&nbsp;

endereço salvo no próprio pedido

&nbsp;

Não substituir pelo endereço cadastral atual do cliente.

&nbsp;

Pedido com source = client

&nbsp;

Carregar como read only.

&nbsp;

Não exigir nova confirmação.

&nbsp;

Pedido com source = custom já confirmado

&nbsp;

Carregar o endereço custom existente como read only.

&nbsp;

Não exigir nova confirmação apenas porque o pedido foi aberto para edição.

&nbsp;

Mostrar:

&nbsp;

Endereço específico deste pedido

&nbsp;

[ ALTERAR ENDEREÇO ]

&nbsp;

Somente ao clicar Alterar Endereço:

&nbsp;

deliveryAddressConfirmed = false

&nbsp;

e liberar edição.

&nbsp;

---

&nbsp;

23. PEDIDOS LEGADOS

&nbsp;

Para pedidos antigos sem:

&nbsp;

deliveryAddress

deliveryAddressSource

&nbsp;

usar o endereço cadastral atual do cliente como fallback, desde que completo.

&nbsp;

Definir:

&nbsp;

deliveryAddressSource = "client"

&nbsp;

Não exigir Google.

&nbsp;

---

&nbsp;

24. CORRIGIR SALVAMENTO DO PEDIDO

&nbsp;

O pedido atualmente deixou de ser salvo depois das alterações de endereço.

&nbsp;

Antes de alterar backend, rastrear:

&nbsp;

Finalizar Pedido

↓

validação

↓

ERP payload

↓

POST ERP

↓

resposta

↓

snapshot Supabase

↓

navegação

&nbsp;

Adicionar logs temporários:

&nbsp;

[ORDER SAVE] start

[ORDER SAVE] validation result

[ORDER SAVE] ERP payload built

[ORDER SAVE] POST started

[ORDER SAVE] POST response

[ORDER SAVE] snapshot started

[ORDER SAVE] snapshot response

[ORDER SAVE] finished

&nbsp;

---

&nbsp;

25. ERP PAYLOAD E SNAPSHOT DEVEM SER SEPARADOS

&nbsp;

Campos operacionais de endereço NÃO devem vazar para o payload estrito do ERP.

&nbsp;

Auditar especialmente:

&nbsp;

deliveryAddress

deliveryAddressSource

deliveryAddressConfirmed

formattedAddress

latitude

longitude

placeId

complement

reference

&nbsp;

Manter:

&nbsp;

const erpPayload = ...

const operationalSnapshot = ...

&nbsp;

O ERP recebe somente campos homologados.

&nbsp;

O Supabase recebe metadados operacionais.

&nbsp;

Não ampliar o schema do Node apenas para aceitar campos de UI.

&nbsp;

---

&nbsp;

26. SE O ERP JÁ CRIOU O PEDIDO

&nbsp;

Se:

&nbsp;

POST ERP → 201

&nbsp;

mas depois ocorrer erro no snapshot:

&nbsp;

não repetir o POST.

&nbsp;

Não criar pedido duplicado.

&nbsp;

Mostrar corretamente que:

&nbsp;

Pedido criado no ERP

Falha ao salvar dados operacionais

&nbsp;

e tratar o snapshot separadamente.

&nbsp;

---

&nbsp;

27. PRIMEIRO FOCO DA ETAPA 3

&nbsp;

Ao entrar em Entrega:

&nbsp;

NÃO:

&nbsp;

- focar Logradouro;

- abrir teclado;

- iniciar Google;

- abrir mapa.

&nbsp;

Primeiro mostrar:

&nbsp;

ENTREGA

RETIRADA

&nbsp;

Somente após selecionar ENTREGA mostrar o endereço.

&nbsp;

Somente ao clicar ALTERAR ENDEREÇO iniciar a experiência Google.

&nbsp;

---

&nbsp;

28. TESTE — RETIRADA

&nbsp;

Fluxo:

&nbsp;

3. Entrega

→ RETIRADA

&nbsp;

Esperado:

&nbsp;

- endereço oculto;

- Google não carregado;

- mapa não carregado;

- próximo liberado;

- pedido salva normalmente.

&nbsp;

---

&nbsp;

29. TESTE — ENTREGA COM ENDEREÇO CADASTRAL

&nbsp;

Cliente:

&nbsp;

R ROBERTO ZIEMANN

1963

AMIZADE

JARAGUÁ DO SUL

SC

&nbsp;

Fluxo:

&nbsp;

3. Entrega

→ ENTREGA

&nbsp;

Esperado imediatamente:

&nbsp;

Endereço do cadastro do cliente

&nbsp;

R Roberto Ziemann, 1963

Amizade

Jaraguá do Sul - SC

&nbsp;

[ ALTERAR ENDEREÇO ]

&nbsp;

Obrigatório:

&nbsp;

- read only;

- nenhum teclado;

- nenhuma pesquisa Google;

- nenhuma confirmação adicional;

- próximo habilitado;

- pedido salva.

&nbsp;

---

&nbsp;

30. TESTE — ALTERAR ENDEREÇO

&nbsp;

Fluxo:

&nbsp;

ENTREGA

→ ALTERAR ENDEREÇO

&nbsp;

Esperado:

&nbsp;

deliveryAddressSource = "custom"

deliveryAddressConfirmed = false

&nbsp;

Campos ficam editáveis.

&nbsp;

Pesquisar outra rua.

&nbsp;

Selecionar.

&nbsp;

Preencher Número.

&nbsp;

Validar/geocodificar quando possível.

&nbsp;

Confirmar.

&nbsp;

Esperado:

&nbsp;

deliveryAddressConfirmed = true

&nbsp;

Próximo liberado.

&nbsp;

Pedido salvo com endereço custom no snapshot.

&nbsp;

Cadastro do cliente permanece intacto.

&nbsp;

---

&nbsp;

31. TESTE — RESTAURAR CADASTRO

&nbsp;

Depois de entrar em custom:

&nbsp;

USAR ENDEREÇO DO CADASTRO

&nbsp;

Esperado:

&nbsp;

deliveryAddressSource = "client"

&nbsp;

- endereço cadastral restaurado;

- read only;

- sem confirmação;

- próximo liberado.

&nbsp;

---

&nbsp;

32. TESTE — SALVAMENTO

&nbsp;

Criar um pedido completo.

&nbsp;

Finalizar.

&nbsp;

Obrigatório registrar:

&nbsp;

POST /api/v1/orders executado: SIM/NÃO

&nbsp;

HTTP:

____

&nbsp;

orderNumber:

____

&nbsp;

Snapshot Supabase:

SIM/NÃO

&nbsp;

Resultado esperado:

&nbsp;

POST ERP → 201

pedido criado

snapshot salvo

listagem atualizada

&nbsp;

---

&nbsp;

33. TESTE — EDIÇÃO

&nbsp;

Editar pedido existente.

&nbsp;

Confirmar:

&nbsp;

- endereço histórico daquele pedido é preservado;

- não substituir pelo endereço atual do cliente;

- endereço permanece read only até clicar Alterar;

- endereço custom previamente confirmado continua válido;

- salvar edição continua funcionando.

&nbsp;

---

&nbsp;

34. NÃO ALTERAR

&nbsp;

Não alterar desnecessariamente:

&nbsp;

- Google Maps Managed by Lovable;

- Autocomplete Data API (New);

- equipamentos;

- cobertura;

- pagamentos;

- identity lock;

- regras de status;

- lógica dos produtos.

&nbsp;

Node somente deve ser alterado se o diagnóstico real do POST demonstrar necessidade.

&nbsp;

---

&nbsp;

RELATÓRIO FINAL OBRIGATÓRIO

&nbsp;

SPRINT 8.9.38

&nbsp;

SALVAMENTO

&nbsp;

Causa exata do pedido não salvar:

________________________________

&nbsp;

POST ERP executado:

SIM/NÃO

&nbsp;

HTTP:

____

&nbsp;

ERP orderNumber:

____

&nbsp;

Campos operacionais vazavam no ERP payload:

SIM/NÃO

&nbsp;

Campos:

________________________________

&nbsp;

ERP payload separado do snapshot:

PASS/FAIL

&nbsp;

Pedido criado no ERP:

PASS/FAIL

&nbsp;

Snapshot Supabase salvo:

PASS/FAIL

&nbsp;

&nbsp;

LOGÍSTICA

&nbsp;

Etapa começa por ENTREGA / RETIRADA:

PASS/FAIL

&nbsp;

Foco automático no endereço removido:

PASS/FAIL

&nbsp;

&nbsp;

RETIRADA

&nbsp;

Endereço oculto:

PASS/FAIL

&nbsp;

Google não inicializado:

PASS/FAIL

&nbsp;

Mapa não inicializado:

PASS/FAIL

&nbsp;

Avança normalmente:

PASS/FAIL

&nbsp;

Pedido salva:

PASS/FAIL

&nbsp;

&nbsp;

ENDEREÇO CADASTRAL

&nbsp;

Carregado automaticamente:

PASS/FAIL

&nbsp;

deliveryAddressSource = client:

PASS/FAIL

&nbsp;

Read only:

PASS/FAIL

&nbsp;

Sem confirmação adicional:

PASS/FAIL

&nbsp;

Sem geocodificação obrigatória:

PASS/FAIL

&nbsp;

Próximo habilitado:

PASS/FAIL

&nbsp;

&nbsp;

ENDEREÇO CUSTOM

&nbsp;

Alterar Endereço:

PASS/FAIL

&nbsp;

deliveryAddressSource = custom:

PASS/FAIL

&nbsp;

Campos editáveis:

PASS/FAIL

&nbsp;

Autocomplete Google:

PASS/FAIL

&nbsp;

Número separado:

PASS/FAIL

&nbsp;

Geocodificação:

PASS/FAIL

&nbsp;

Confirmação obrigatória:

PASS/FAIL

&nbsp;

Pedido salva endereço custom:

PASS/FAIL

&nbsp;

&nbsp;

EDIÇÃO

&nbsp;

Endereço histórico preservado:

PASS/FAIL

&nbsp;

Custom confirmado permanece válido:

PASS/FAIL

&nbsp;

Alterar endereço invalida confirmação:

PASS/FAIL

&nbsp;

Edição salva:

PASS/FAIL

&nbsp;

&nbsp;

REGRESSÃO

&nbsp;

CREATE:

PASS/FAIL

&nbsp;

EDIT:

PASS/FAIL

&nbsp;

Cadastro do cliente permanece intacto:

PASS/FAIL

&nbsp;

&nbsp;

NODE ALTERADO:

SIM/NÃO

&nbsp;

Se SIM:

&nbsp;

Arquivo:

________________________________

&nbsp;

Endpoint:

________________________________

&nbsp;

Motivo:

________________________________