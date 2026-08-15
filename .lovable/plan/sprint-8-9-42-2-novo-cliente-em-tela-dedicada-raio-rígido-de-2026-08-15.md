# SPRINT 8.9.42.2 — NOVO CLIENTE EM TELA DEDICADA + RAIO RÍGIDO DE 50 KM

&nbsp;

## OBJETIVO

&nbsp;

Refinar o fluxo já implementado de Novo Cliente ERP.

&nbsp;

Nesta Sprint:

&nbsp;

1. retirar o formulário de Novo Cliente de dentro do card da etapa Cliente;

2. abrir o cadastro em interface dedicada;

3. mobile em modo full-screen;

4. preservar Grupo, Vendedor e Financeiro já implementados;

5. restringir Google Places ao raio de 50 km de Jaraguá do Sul/SC;

6. validar geograficamente também endereços manuais ou alterados;

7. impedir cadastro fora da área;

8. preservar integralmente o ERP e o fluxo atual de pedidos.

&nbsp;

IMPORTANTE:

&nbsp;

Tipo de Venda / Tipo de Operação continua pertencendo SOMENTE AO PEDIDO.

&nbsp;

CLIENTES.ID_OPERACAO continua NULL.

&nbsp;

NODE ALTERADO: NÃO.

&nbsp;

==================================================

1. PRESERVAR FUNCIONALIDADE ATUAL

==================================================

&nbsp;

Preservar:

&nbsp;

- PF/PJ;

- Nome / Razão Social;

- Nome Fantasia;

- CPF/CNPJ;

- Grupo de Cliente;

- Empresa automática/read-only;

- Vendedor automático/read-only;

- Condição de Pagamento;

- Forma de Pagamento;

- WhatsApp/Celular;

- Telefone;

- E-mail;

- endereço;

- Google Places;

- criação direta no ERP;

- confirmação pós-cadastro;

- newOrderFromClient.

&nbsp;

Preservar contratos:

&nbsp;

groupId

paymentTermId

paymentMethodId

sellerId via profiles.erp_seller_id

&nbsp;

Não voltar a hardcodes financeiros.

&nbsp;

==================================================

2. TELA CLIENTE — SIMPLIFICAR

==================================================

&nbsp;

Na etapa Cliente manter somente:

&nbsp;

Empresa

&nbsp;

[ GRAAL ] [ GROTT ]

&nbsp;

Buscar cliente

&nbsp;

[ Digite nome, código ou documento ]

&nbsp;

[ + Novo Cliente ]

&nbsp;

O formulário inteiro NÃO deve mais ser renderizado dentro desse card.

&nbsp;

==================================================

3. NOVO CLIENTE — INTERFACE DEDICADA

==================================================

&nbsp;

Ao tocar:

&nbsp;

+ Novo Cliente

&nbsp;

abrir Sheet/Dialog dedicado.

&nbsp;

Não criar nova rota.

&nbsp;

O usuário continua dentro tecnicamente de:

&nbsp;

Novo Pedido.

&nbsp;

==================================================

4. MOBILE FULL-SCREEN

==================================================

&nbsp;

No mobile:

&nbsp;

- ocupar praticamente 100% da viewport;

- usar altura compatível com viewport dinâmica, preferencialmente 100dvh;

- scroll somente dentro do cadastro;

- bloquear scroll da página atrás;

- cabeçalho próprio;

- botão fechar/cancelar acessível.

&nbsp;

Estrutura:

&nbsp;

┌──────────────────────────────┐

│ ← Novo Cliente ERP       X   │

├──────────────────────────────┤

│ DADOS DO CLIENTE             │

│ ...                          │

│ COMERCIAL                    │

│ ...                          │

│ FINANCEIRO                   │

│ ...                          │

│ CONTATO                      │

│ ...                          │

│ ENDEREÇO                     │

│ ...                          │

│                              │

│ [ Cadastrar cliente ]        │

└──────────────────────────────┘

&nbsp;

No desktop:

&nbsp;

Dialog grande ou Sheet lateral larga.

&nbsp;

==================================================

5. CANCELAR

==================================================

&nbsp;

Cancelar deve:

&nbsp;

- fechar o cadastro;

- manter empresa selecionada;

- voltar à busca;

- não selecionar cliente;

- não criar pedido;

- não alterar itens;

- não alterar equipamentos;

- não chamar ERP.

&nbsp;

==================================================

6. ORDEM DO FORMULÁRIO

==================================================

&nbsp;

DADOS DO CLIENTE

&nbsp;

- PF/PJ

- Nome / Razão Social

- Nome Fantasia

- CPF/CNPJ

&nbsp;

COMERCIAL

&nbsp;

- Grupo do Cliente *

- Empresa read-only

- Vendedor automático/read-only

&nbsp;

FINANCEIRO

&nbsp;

- Condição de Pagamento *

- Forma de Pagamento *

&nbsp;

CONTATO

&nbsp;

- WhatsApp/Celular *

- Telefone

- E-mail

&nbsp;

ENDEREÇO

&nbsp;

- Buscar endereço

- Rua

- Número

- Bairro

- Cidade

- UF

- CEP

- Complemento

&nbsp;

==================================================

7. REGRA RÍGIDA DE ATENDIMENTO

==================================================

&nbsp;

O sistema NÃO permite cadastrar cliente fora de:

&nbsp;

50 km de Jaraguá do Sul/SC.

&nbsp;

Criar constantes únicas reutilizáveis:

&nbsp;

CUSTOMER_SERVICE_AREA_CENTER = {

  lat: -26.48,

  lng: -49.07

}

&nbsp;

CUSTOMER_SERVICE_RADIUS_METERS = 50000

&nbsp;

Não duplicar coordenadas e raio em vários arquivos.

&nbsp;

==================================================

8. HELPER GEO

==================================================

&nbsp;

Criar:

&nbsp;

src/utils/geo-utils.ts

&nbsp;

ou equivalente.

&nbsp;

Deve conter funções puras, utilizáveis tanto pelo frontend quanto pela Server Function.

&nbsp;

Exemplo:

&nbsp;

distanceMetersBetweenCoordinates(...)

&nbsp;

isWithinCustomerServiceArea(lat, lng)

&nbsp;

Regra definitiva:

&nbsp;

distance <= 50000

→ permitido

&nbsp;

distance > 50000

→ proibido

&nbsp;

Usar Haversine/geodésico.

&nbsp;

==================================================

9. GOOGLE PLACES — LOCATION RESTRICTION

==================================================

&nbsp;

No cadastro de NOVO CLIENTE substituir:

&nbsp;

locationBias

&nbsp;

por:

&nbsp;

locationRestriction

&nbsp;

Continuar:

&nbsp;

includedRegionCodes: ["br"]

&nbsp;

NÃO utilizar locationBias e locationRestriction simultaneamente.

&nbsp;

Para o Places Data API usado atualmente pelo projeto, utilizar o tipo/sintaxe

EXATOS suportados por AutocompleteSuggestion.fetchAutocompleteSuggestions().

&nbsp;

Conceitualmente:

&nbsp;

locationRestriction: {

  center: {

    lat: -26.48,

    lng: -49.07

  },

  radius: 50000

}

&nbsp;

IMPORTANTE:

&nbsp;

Não copiar cegamente o formato REST:

&nbsp;

{

  circle: { ... }

}

&nbsp;

se o tipo TypeScript atual da Maps JavaScript API esperar CircleLiteral diretamente.

&nbsp;

Deixar o TypeScript validar o contrato real.

&nbsp;

==================================================

10. AUTOCOMPLETE

==================================================

&nbsp;

Continuar usando:

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

Manter:

&nbsp;

includedRegionCodes: ["br"]

&nbsp;

A busca deve retornar somente sugestões pertinentes à área restrita.

&nbsp;

==================================================

11. PLACE SELECIONADO

==================================================

&nbsp;

Ao selecionar sugestão:

&nbsp;

buscar:

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

→ Rua

&nbsp;

street_number

→ Número

&nbsp;

neighborhood / sublocality

→ Bairro

&nbsp;

locality / administrative_area_level_2

→ Cidade

&nbsp;

administrative_area_level_1.shortText

→ UF

&nbsp;

postal_code

→ CEP

&nbsp;

Também obter:

&nbsp;

place.location

&nbsp;

==================================================

12. VALIDAÇÃO DO PLACE

==================================================

&nbsp;

Após obter place.location:

&nbsp;

calcular distância ao centro de Jaraguá.

&nbsp;

Se:

&nbsp;

<= 50000

&nbsp;

marcar:

&nbsp;

addressValidationStatus = "valid"

&nbsp;

guardar:

&nbsp;

lat

lng

&nbsp;

Se:

&nbsp;

> 50000

&nbsp;

marcar:

&nbsp;

addressValidationStatus = "outside"

&nbsp;

bloquear cadastro.

&nbsp;

==================================================

13. CAMPOS QUE INVALIDAM A VALIDAÇÃO

==================================================

&nbsp;

Após endereço validado, se o vendedor alterar qualquer um destes campos:

&nbsp;

Rua

Número

Bairro

Cidade

UF

CEP

&nbsp;

a validação geográfica anterior fica IMEDIATAMENTE inválida.

&nbsp;

Alterar estado para algo equivalente a:

&nbsp;

addressValidationStatus = "dirty"

&nbsp;

e descartar/rejeitar as coordenadas anteriores para fins de submit.

&nbsp;

Não permitir cadastro até nova validação.

&nbsp;

Alterar somente:

&nbsp;

Complemento

&nbsp;

NÃO precisa invalidar a localização.

&nbsp;

==================================================

14. ENDEREÇO MANUAL

==================================================

&nbsp;

Continuar permitindo preenchimento manual.

&nbsp;

Porém agora endereço manual NÃO pode ser cadastrado sem validação.

&nbsp;

Antes do submit montar string completa, por exemplo:

&nbsp;

Rua X, 123, Bairro Y, Jaraguá do Sul, SC, CEP, Brasil

&nbsp;

e geocodificar usando:

&nbsp;

google.maps.Geocoder

&nbsp;

ou implementação equivalente já suportada pelo Maps JavaScript carregado no projeto.

&nbsp;

O Geocoder transforma endereço em coordenadas; essas coordenadas serão usadas na

mesma verificação de distância. 

&nbsp;

==================================================

15. RESULTADO DO GEOCODER

==================================================

&nbsp;

Se geocodificação retornar resultado:

&nbsp;

obter:

&nbsp;

results[0].geometry.location

&nbsp;

calcular distância.

&nbsp;

<= 50000

→ valid

&nbsp;

> 50000

→ outside

&nbsp;

ZERO_RESULTS ou falha:

&nbsp;

addressValidationStatus = "error"

&nbsp;

Não cadastrar.

&nbsp;

Mostrar:

&nbsp;

"Não foi possível validar este endereço. Confira os dados e tente novamente."

&nbsp;

==================================================

16. GOOGLE INDISPONÍVEL

==================================================

&nbsp;

Como o raio é REGRA DE NEGÓCIO rígida:

&nbsp;

se não for possível obter coordenadas confiáveis:

&nbsp;

NÃO permitir finalizar cadastro.

&nbsp;

Mensagem:

&nbsp;

"Não foi possível validar a área de atendimento. Tente novamente."

&nbsp;

==================================================

17. MENSAGEM FORA DA ÁREA

==================================================

&nbsp;

Se distância > 50 km:

&nbsp;

mostrar:

&nbsp;

"Endereço fora da área de atendimento."

&nbsp;

Subtexto:

&nbsp;

"O cadastro de clientes está limitado a um raio de 50 km de Jaraguá do Sul/SC."

&nbsp;

Não chamar createErpClient().

&nbsp;

==================================================

18. FEEDBACK DE VALIDAÇÃO

==================================================

&nbsp;

Dentro do raio:

&nbsp;

mostrar discretamente:

&nbsp;

✓ Endereço dentro da área de atendimento

&nbsp;

Não precisa exibir distância numérica ao vendedor.

&nbsp;

==================================================

19. SUBMIT

==================================================

&nbsp;

Antes de createErpClient() exigir:

&nbsp;

- formulário válido;

- Grupo selecionado;

- Condição selecionada;

- Forma selecionada;

- endereço obrigatório preenchido;

- addressValidationStatus === "valid";

- coordenadas existentes;

- distância <= 50000.

&nbsp;

==================================================

20. SERVER FUNCTION

==================================================

&nbsp;

createErpClient deve receber adicionalmente:

&nbsp;

addressValidation: {

  lat,

  lng

}

&nbsp;

Na Server Function:

&nbsp;

recalcular Haversine usando o MESMO helper e as mesmas constantes.

&nbsp;

Se:

&nbsp;

distance > 50000

&nbsp;

retornar:

&nbsp;

ADDRESS_OUTSIDE_SERVICE_AREA

&nbsp;

e NÃO chamar o Node ERP.

&nbsp;

Não confiar apenas na validação visual do componente.

&nbsp;

==================================================

21. OBSERVAÇÃO SOBRE SEGURANÇA

==================================================

&nbsp;

A Server Function deve recalcular a distância e nunca aceitar um boolean:

&nbsp;

withinArea: true

&nbsp;

enviado pelo frontend como prova suficiente.

&nbsp;

Receber coordenadas numéricas e calcular novamente.

&nbsp;

Esta é a proteção operacional desta Sprint.

&nbsp;

Não adicionar infraestrutura externa nova nesta Sprint.

&nbsp;

==================================================

22. COORDENADAS NÃO VÃO PARA FIREBIRD

==================================================

&nbsp;

lat/lng servem somente para validação.

&nbsp;

Não adicionar ao payload Node.

&nbsp;

Não mapear para:

&nbsp;

SP_CAD_CLIENTE_COMPLETO.LATLONG

&nbsp;

Continuar:

&nbsp;

LATLONG = NULL.

&nbsp;

==================================================

23. ERRO SERVER FUNCTION

==================================================

&nbsp;

Se retornar:

&nbsp;

ADDRESS_OUTSIDE_SERVICE_AREA

&nbsp;

frontend mostra:

&nbsp;

"Endereço fora da área de atendimento."

&nbsp;

Não cadastrar cliente.

&nbsp;

==================================================

24. NÃO ALTERAR FLUXO DE ENTREGA

==================================================

&nbsp;

A regra de 50 km desta Sprint aplica-se SOMENTE ao:

&nbsp;

CADASTRO DE NOVO CLIENTE.

&nbsp;

Não alterar:

&nbsp;

delivery-address-section.tsx

&nbsp;

nem regras atuais da etapa Entrega.

&nbsp;

Essa decisão pode ser tratada separadamente depois.

&nbsp;

==================================================

25. FINANCEIRO — PRESERVAR

==================================================

&nbsp;

Preservar:

&nbsp;

Grupo do cliente

Condição de Pagamento

Forma de Pagamento

Vendedor automático

&nbsp;

Mapeamento continua:

&nbsp;

groupId

→ ID_GRUPO_CLIENTE

&nbsp;

paymentTermId

→ ID_PRAZO

&nbsp;

paymentMethodId

→ ID_FORMA_PAGAMENTO

&nbsp;

profiles.erp_seller_id

→ ID_VENDEDOR

&nbsp;

Tipo de Venda NÃO entra.

&nbsp;

ID_OPERACAO continua NULL.

&nbsp;

==================================================

26. CADASTRO COM SUCESSO

==================================================

&nbsp;

Após:

&nbsp;

Cadastrar cliente

&nbsp;

mostrar:

&nbsp;

✓ CLIENTE CADASTRADO NO ERP

&nbsp;

Nome

Cliente ERP XXXXX

&nbsp;

[ Gerar novo pedido para este cliente ]

&nbsp;

[ Voltar ]

&nbsp;

Não avançar automaticamente.

&nbsp;

==================================================

27. GERAR NOVO PEDIDO

==================================================

&nbsp;

Ao tocar:

&nbsp;

Gerar novo pedido para este cliente

&nbsp;

usar:

&nbsp;

newOrderFromClient(

  createdClient.id,

  createdClient.name,

  companyId

)

&nbsp;

Depois:

&nbsp;

fechar Sheet/Dialog

&nbsp;

setStep("items")

&nbsp;

Não duplicar lógica do store.

&nbsp;

==================================================

28. NÃO ALTERAR NODE

==================================================

&nbsp;

Não alterar:

&nbsp;

erp-api/

&nbsp;

Não alterar:

&nbsp;

SP_CAD_CLIENTE_COMPLETO

SP_CAD_CONTATOS

clients mapper

34 parâmetros

ID_OPERACAO

ID_PRAZO

ID_FORMA_PAGAMENTO

ID_VENDEDOR

&nbsp;

NODE ALTERADO:

NÃO

&nbsp;

==================================================

29. NÃO ALTERAR ÁREAS ESTÁVEIS

==================================================

&nbsp;

Não alterar:

&nbsp;

CREATE pedido

EDIT pedido

Tipo de Venda do pedido

payment flow

equipamentos

cobertura

entrega

recolha

status ERP

batch-status

APP-XXXX

paginação

cards

Supabase schema

&nbsp;

==================================================

30. TESTES UI

==================================================

&nbsp;

Novo Cliente abre interface dedicada:

PASS/FAIL

&nbsp;

Não fica mais inline:

PASS/FAIL

&nbsp;

Mobile full-screen:

PASS/FAIL

&nbsp;

Scroll interno:

PASS/FAIL

&nbsp;

Background sem scroll:

PASS/FAIL

&nbsp;

Cancelar:

PASS/FAIL

&nbsp;

Empresa preservada:

PASS/FAIL

&nbsp;

Grupo preservado:

PASS/FAIL

&nbsp;

Financeiro preservado:

PASS/FAIL

&nbsp;

Vendedor preservado:

PASS/FAIL

&nbsp;

==================================================

31. TESTES GEO

==================================================

&nbsp;

locationBias removido:

PASS/FAIL

&nbsp;

locationRestriction configurado:

PASS/FAIL

&nbsp;

includedRegionCodes BR:

PASS/FAIL

&nbsp;

Centro Jaraguá:

PASS/FAIL

&nbsp;

Raio 50000:

PASS/FAIL

&nbsp;

Autocomplete dentro do raio:

PASS/FAIL

&nbsp;

Place validado por Haversine:

PASS/FAIL

&nbsp;

Rua alterada invalida:

PASS/FAIL

&nbsp;

Número alterado invalida:

PASS/FAIL

&nbsp;

Bairro alterado invalida:

PASS/FAIL

&nbsp;

Cidade alterada invalida:

PASS/FAIL

&nbsp;

UF alterada invalida:

PASS/FAIL

&nbsp;

CEP alterado invalida:

PASS/FAIL

&nbsp;

Complemento não invalida:

PASS/FAIL

&nbsp;

Manual geocodificado:

PASS/FAIL

&nbsp;

Fora do raio bloqueado:

PASS/FAIL

&nbsp;

Server Function recalcula:

PASS/FAIL

&nbsp;

==================================================

32. TESTE MANUAL RECOMENDADO

==================================================

&nbsp;

Testar:

&nbsp;

Jaraguá do Sul

→ permitir.

&nbsp;

Endereço próximo dentro de 50 km

→ permitir.

&nbsp;

Endereço claramente distante

→ bloquear.

&nbsp;

Endereço selecionado dentro do raio e depois alterado manualmente para cidade

distante

→ validação deve ficar dirty;

→ nova geocodificação deve bloquear.

&nbsp;

==================================================

33. REGRESSÃO

==================================================

&nbsp;

Cliente existente:

PASS/FAIL

&nbsp;

Busca:

PASS/FAIL

&nbsp;

Novo cliente:

PASS/FAIL

&nbsp;

Cadastro ERP:

PASS/FAIL

&nbsp;

Gerar pedido:

PASS/FAIL

&nbsp;

CREATE pedido:

PASS/FAIL

&nbsp;

EDIT pedido:

PASS/FAIL

&nbsp;

Google Maps Entrega:

PASS/FAIL

&nbsp;

Pagamento:

PASS/FAIL

&nbsp;

APP-XXXX:

PASS/FAIL

&nbsp;

Paginação:

PASS/FAIL

&nbsp;

==================================================

34. RELATÓRIO FINAL

==================================================

&nbsp;

ARQUIVOS ALTERADOS:

&nbsp;

FORMULÁRIO INLINE REMOVIDO:

SIM/NÃO

&nbsp;

MOBILE FULL-SCREEN:

SIM/NÃO

&nbsp;

LOCATION BIAS:

REMOVIDO

&nbsp;

LOCATION RESTRICTION:

SIM/NÃO

&nbsp;

FORMATO locationRestriction USADO:

&nbsp;

CENTRO:

-26.48, -49.07

&nbsp;

RAIO:

50000

&nbsp;

HAVERSINE FRONTEND:

SIM/NÃO

&nbsp;

HAVERSINE SERVER FUNCTION:

SIM/NÃO

&nbsp;

ENDEREÇO MANUAL GEOCODIFICADO:

SIM/NÃO

&nbsp;

EDIÇÃO INVALIDA VALIDAÇÃO:

SIM/NÃO

&nbsp;

FORA DE 50KM BLOQUEADO:

SIM/NÃO

&nbsp;

GRUPO PRESERVADO:

SIM/NÃO

&nbsp;

FINANCEIRO PRESERVADO:

SIM/NÃO

&nbsp;

VENDEDOR PRESERVADO:

SIM/NÃO

&nbsp;

TIPO DE VENDA NO CLIENTE:

NÃO

&nbsp;

ID_OPERACAO:

NULL

&nbsp;

LATLONG ERP:

NULL

&nbsp;

newOrderFromClient:

REUTILIZADO SIM/NÃO

&nbsp;

NODE ALTERADO:

NÃO

&nbsp;

REGRESSÕES: