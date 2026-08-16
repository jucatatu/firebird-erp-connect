import { createFileRoute } from '@tanstack/react-router'

const content = `Execute esta instrucao no projeto: # SPRINT 8.9.42.2.2 — HOTFIX GRUPO + EMPRESA + GOOGLE MAPS DO NOVO CLIENTE

## OBJETIVO

Corrigir exclusivamente três problemas confirmados no cadastro de Novo Cliente ERP:

1. Grupo de Cliente não está sendo listado;
2. Empresa fica fixa conforme a seleção anterior e não pode ser alterada dentro do cadastro;
3. Google Places não retorna sugestões corretamente após a implementação da regra regional de 50 km.

IMPORTANTE:

Preservar integralmente tudo que já está funcionando:

- somente UM botão "+ Novo Cliente";
- Sheet global, fora das condicionais do wizard;
- Novo Cliente abre corretamente no step "client";
- cadastro em tela dedicada/full-screen no mobile;
- PF/PJ;
- CPF/CNPJ;
- contatos;
- financeiro;
- cadastro direto no ERP;
- duplicidade;
- confirmação pós-cadastro;
- newOrderFromClient;
- regra rígida de 50 km;
- Haversine server-side.

NÃO reintroduzir formulário inline.
NÃO criar segundo botão Novo Cliente.
NÃO refatorar áreas estáveis.

==================================================
1. CUSTOMER GROUPS — PROBLEMA CONFIRMADO
==================================================

No Node atual existe consulta em:

erp-api/src/modules/customer-groups/customer-groups.repository.js

que referencia:

INATIVO

porém o schema REAL confirmado de GRUPO_CLIENTE possui:

ID_GRUPO_CLIENTE
DESCRICAO
DELETED
DATE_CAD
DATE_UPDATE
CONSUMIDOR_FINAL
REVENDA_VAREJO
REVENDA_ATACADO
OBSERVACAO
DEL_USER
CAD_USER
COMISSAO
UP_USER

NÃO existe:

INATIVO

Portanto corrigir a query.

==================================================
2. CORRIGIR CUSTOMER GROUPS NO NODE
==================================================

Utilizar:

SELECT
  ID_GRUPO_CLIENTE,
  DESCRICAO
FROM GRUPO_CLIENTE
WHERE (DELETED IS NULL OR DELETED = 0)
ORDER BY DESCRICAO

NÃO referenciar INATIVO.

Preservar o contrato:

{
  groups: [
    {
      id,
      description
    }
  ]
}

Não hardcodar grupos.

Não modificar IDs.

==================================================
3. UX DE CUSTOMER GROUPS
==================================================

Arquivo:

src/components/client/create-client-form.tsx

Hoje o Select pode simplesmente ficar vazio quando a consulta falha.

Melhorar o estado visual.

Enquanto estiver carregando:

"Carregando grupos..."

Select disabled.

Se ocorrer erro:

"Não foi possível carregar os grupos de clientes do ERP."

Não permitir cadastrar cliente sem grupo.

Quando carregar:

usar normalmente os grupos vindos do ERP.

==================================================
4. GRUPO CONTINUA OBRIGATÓRIO
==================================================

groupId continua obrigatório.

Mapeamento:

groupId
→ CLIENTES.ID_GRUPO_CLIENTE

Não selecionar grupo automaticamente.

Não hardcodar:

Consumidor Final
Ponto de Venda
etc.

==================================================
5. EMPRESA — COMPORTAMENTO DESEJADO
==================================================

Hoje o Novo Cliente herda corretamente a empresa escolhida antes de abrir.

Exemplo:

GRAAL selecionada
→ Novo Cliente abre em GRAAL

GROTT selecionada
→ Novo Cliente abre em GROTT

PRESERVAR isso como valor inicial.

Porém permitir trocar a empresa DENTRO do Novo Cliente antes do cadastro.

==================================================
6. EMPRESA EDITÁVEL
==================================================

Na seção COMERCIAL mostrar:

EMPRESA *

[ GRAAL ] [ GROTT ]

Seguir o mesmo padrão visual da seleção de empresa já existente no step Cliente.

Mostrar somente empresas às quais o usuário possui acesso.

Se usuário possui acesso somente a uma:

mostrar somente essa/read-only.

Se possui acesso a ambas:

permitir alternar entre:

1 = GRAAL
3 = GROTT

==================================================
7. UMA ÚNICA FONTE DE VERDADE
==================================================

NÃO criar um companyId independente somente dentro do formulário.

A empresa escolhida dentro do Novo Cliente deve atualizar também o companyId real
do wizard.

CreateClientForm deve receber callback equivalente a:

onCompanyChange(companyId)

Ao trocar dentro do cadastro:

GRAAL → GROTT

o wizard também deve passar a:

companyId = 3

E vice-versa.

Isso evita divergência entre:

cliente criado na GROTT

e

pedido ainda marcado como GRAAL.

==================================================
8. REACT HOOK FORM
==================================================

defaultValues do React Hook Form não atualizam automaticamente quando uma prop muda.

Ao trocar empresa:

executar também algo equivalente a:

form.setValue("companyId", newCompanyId, {
  shouldDirty: true,
  shouldValidate: true
})

O payload enviado ao createErpClient deve usar exatamente a empresa atualmente
selecionada e visível.

==================================================
9. TROCA DE EMPRESA — PRESERVAR DADOS
==================================================

Ao alternar:

GRAAL ↔ GROTT

NÃO limpar:

- tipo PF/PJ;
- nome;
- razão social;
- CPF/CNPJ;
- nome fantasia;
- WhatsApp;
- telefone;
- e-mail;
- condição de pagamento;
- forma de pagamento;
- endereço;
- Google;
- dados já digitados.

Não fechar o Sheet.

==================================================
10. TROCA DE EMPRESA — LIMPAR GRUPO
==================================================

Ao trocar empresa:

limpar somente:

groupId

e obrigar nova seleção do Grupo de Cliente.

Não manter silenciosamente um grupo selecionado anteriormente.

Não apagar os demais campos.

==================================================
11. SEGURANÇA DE EMPRESA
==================================================

Preservar a validação server-side existente em:

createErpClient

via:

user_company_access

O frontend controla a UX.

A Server Function continua sendo autoridade final.

Não permitir cadastrar para empresa sem acesso.

==================================================
12. GOOGLE PLACES — CORRIGIR LOCATION RESTRICTION
==================================================

No fluxo atual do Novo Cliente foi implementada restrição regional.

Garantir que o request utilizado por:

AutocompleteSuggestion.fetchAutocompleteSuggestions()

use o formato correto esperado pela Maps JavaScript Places Data API atual.

Para este contrato, utilizar:

LatLngBoundsLiteral

com:

north
south
east
west

em:

locationRestriction

Não usar formato incompatível de círculo se o TypeScript/contrato atual não aceitar.

==================================================
13. BOUNDING BOX DA ÁREA DE JARAGUÁ
==================================================

Criar helper único em:

src/utils/geo-utils.ts

ou equivalente:

getCustomerServiceAreaBounds()

Centro operacional:

lat = -26.48
lng = -49.07

Área de busca:

aproximadamente 50 km para:

norte
sul
leste
oeste

O helper deve retornar:

{
  north,
  south,
  east,
  west
}

Não espalhar coordenadas derivadas pelo componente.

==================================================
14. AUTOCOMPLETE REQUEST
==================================================

Montar o request usando tipo real quando possível:

google.maps.places.AutocompleteRequest

Conceitualmente:

{
  input: addressQuery,

  includedRegionCodes: ["br"],

  locationRestriction: getCustomerServiceAreaBounds(),

  origin: {
    lat: -26.48,
    lng: -49.07
  },

  sessionToken
}

Evitar:

const request: any

se isso esconder novamente erro de contrato.

==================================================
15. BOUNDING BOX NÃO SUBSTITUI O RAIO REAL
==================================================

A restrição das sugestões é um RETÂNGULO.

A regra comercial continua sendo:

CÍRCULO REAL DE 50 KM.

Portanto preservar:

isWithinCustomerServiceArea(lat, lng)

com Haversine.

Place selecionado:

<= 50000 m
→ permitido

> 50000 m
→ bloqueado

A validação Haversine continua sendo a autoridade final.

==================================================
16. CANTOS DO RETÂNGULO
==================================================

O bounding box pode conter pontos nos cantos que ficam a mais de 50 km do centro.

Isso é esperado.

Se um resultado desses for selecionado:

place.location
→ Haversine
→ > 50000
→ bloquear cadastro.

Mensagem:

"Endereço fora da área de atendimento."

Subtexto:

"O cadastro de clientes está limitado a um raio de 50 km de Jaraguá do Sul/SC."

==================================================
17. ERROS DO GOOGLE NÃO PODEM SER SILENCIOSOS
==================================================

Adicionar estado equivalente a:

placesSearchError

Se fetchAutocompleteSuggestions falhar:

mostrar abaixo da busca:

"Não foi possível pesquisar endereços no Google Maps. Tente novamente."

Diferenciar:

ERRO DA API

de:

ZERO RESULTADOS.

Zero resultados legítimos:

"Nenhum endereço encontrado nesta área."

==================================================
18. SESSION TOKEN
==================================================

Preservar:

AutocompleteSessionToken

Após seleção concluída:

gerar novo sessionToken para a próxima pesquisa.

Não remover a sessão do autocomplete.

==================================================
19. PLACE SELECIONADO
==================================================

Ao selecionar sugestão:

prediction.toPlace()

depois:

place.fetchFields({
  fields: [
    "addressComponents",
    "formattedAddress",
    "location",
    "id",
    "displayName"
  ]
})

Preencher:

route
→ rua

street_number
→ número

neighborhood / sublocality
→ bairro

locality / administrative_area_level_2
→ cidade

administrative_area_level_1.shortText
→ UF

postal_code
→ CEP

UF deve continuar com 2 caracteres.

==================================================
20. VALIDAÇÃO DO PLACE
==================================================

Quando place.location existir:

guardar temporariamente:

lat
lng

e calcular Haversine.

Dentro de 50 km:

addressValidationStatus = valid

Fora:

addressValidationStatus = outside

Não chamar createErpClient se estiver outside.

==================================================
21. ENDEREÇO ALTERADO MANUALMENTE
==================================================

Se após seleção Google o vendedor alterar:

Rua
Número
Bairro
Cidade
UF
CEP

invalidar imediatamente a validação anterior:

addressValidationStatus = dirty

Não reutilizar coordenadas antigas.

Complemento NÃO precisa invalidar.

==================================================
22. GEOCODER — IMPORT CORRETO
==================================================

Para endereço manual ou alterado, carregar o Geocoder explicitamente usando:

const { Geocoder } =
  await google.maps.importLibrary("geocoding")

ou helper equivalente tipado.

Não presumir:

window.google.maps.Geocoder

apenas porque Places foi carregado.

==================================================
23. ENDEREÇO MANUAL
==================================================

Preservar fluxo:

endereço manual
→ montar endereço completo
→ Geocoder
→ lat/lng
→ Haversine
→ dentro 50 km permite
→ fora bloqueia.

Se geocodificação falhar:

"Não foi possível validar este endereço. Confira os dados e tente novamente."

Não cadastrar sem validação geográfica.

==================================================
24. SERVER FUNCTION — PRESERVAR VALIDAÇÃO
==================================================

Preservar em:

src/lib/erp-orders.functions.ts

createErpClient

a validação server-side usando as coordenadas recebidas.

A Server Function deve continuar recalculando:

isWithinCustomerServiceArea(...)

e retornar:

ADDRESS_OUTSIDE_SERVICE_AREA

se estiver fora.

Não confiar em boolean vindo do frontend.

==================================================
25. NÃO SALVAR LAT/LNG NO ERP
==================================================

Coordenadas servem somente para validação operacional.

Continuar:

LATLONG = NULL

Não alterar:

SP_CAD_CLIENTE_COMPLETO

para armazenar coordenadas.

==================================================
26. FINANCEIRO — NÃO ALTERAR
==================================================

Preservar:

Condição de Pagamento
Forma de Pagamento

Mapeamento:

paymentTermId
→ ID_PRAZO

paymentMethodId
→ ID_FORMA_PAGAMENTO

Não adicionar Tipo de Venda ao cliente.

CLIENTES.ID_OPERACAO continua NULL.

==================================================
27. VENDEDOR — NÃO ALTERAR
==================================================

Vendedor continua automático:

profiles.erp_seller_id
→ ID_VENDEDOR

Não criar dropdown de vendedores.

==================================================
28. HOTFIX DE SHEET — NÃO REGREDIR
==================================================

Confirmar que permanece:

- somente UM botão "+ Novo Cliente";
- botão ao lado de "Buscar cliente";
- Sheet global;
- Sheet fora de step === "items";
- Sheet abre em step === "client";
- mobile full-screen;
- cancelar retorna para busca;
- não volta a existir formulário inline.

==================================================
29. NODE ALTERADO
==================================================

NODE ALTERADO: SIM

Alteração necessária:

erp-api/src/modules/customer-groups/customer-groups.repository.js

Depois da implementação:

COPIAR/SINCRONIZAR os arquivos alterados do Node para o servidor REAL conectado ao
Firebird.

Depois:

REINICIAR o Node real.

Sem isso:

Grupo de Cliente continuará sem funcionar.

Não executar npm install se package.json não mudar.

==================================================
30. NÃO ALTERAR OUTRAS ÁREAS
==================================================

NÃO alterar:

CREATE pedido
EDIT pedido
Itens
Equipamentos
Cobertura
Entrega
Recolha
Pagamento do pedido
Tipo de Venda do pedido
APP-XXXX
Paginação
Cards
Status ERP
Batch status
Supabase schema
Google Maps da etapa Entrega

==================================================
31. TESTES — GRUPOS
==================================================

GET /api/v1/customer-groups:
PASS/FAIL

Query sem INATIVO:
PASS/FAIL

DELETED filtrado:
PASS/FAIL

Grupos retornados:
PASS/FAIL

Select populado:
PASS/FAIL

Loading:
PASS/FAIL

Erro visível:
PASS/FAIL

Grupo obrigatório:
PASS/FAIL

==================================================
32. TESTES — EMPRESA
==================================================

Selecionar GRAAL antes de abrir:
Novo Cliente abre em GRAAL
PASS/FAIL

Trocar para GROTT dentro do Novo Cliente:
PASS/FAIL

companyId do wizard vira 3:
PASS/FAIL

form.companyId vira 3:
PASS/FAIL

Trocar novamente para GRAAL:
PASS/FAIL

Usuário sem acesso não vê empresa:
PASS/FAIL

Troca limpa somente groupId:
PASS/FAIL

Demais campos permanecem:
PASS/FAIL

==================================================
33. TESTES — GOOGLE
==================================================

Google Places carrega:
PASS/FAIL

AutocompleteSuggestion disponível:
PASS/FAIL

includedRegionCodes ["br"]:
PASS/FAIL

locationRestriction usa LatLngBoundsLiteral:
PASS/FAIL

north:
PASS/FAIL

south:
PASS/FAIL

east:
PASS/FAIL

west:
PASS/FAIL

origin Jaraguá:
PASS/FAIL

"Pedro Francisco" retorna sugestões:
PASS/FAIL

Place retorna location:
PASS/FAIL

Rua preenchida:
PASS/FAIL

Bairro:
PASS/FAIL

Cidade:
PASS/FAIL

UF:
PASS/FAIL

CEP:
PASS/FAIL

Haversine dentro 50km:
PASS/FAIL

Fora 50km bloqueado:
PASS/FAIL

Erro Places visível:
PASS/FAIL

Geocoder importado via "geocoding":
PASS/FAIL

Endereço manual validado:
PASS/FAIL

==================================================
34. REGRESSÃO
==================================================

Único botão Novo Cliente:
PASS/FAIL

Sheet abre:
PASS/FAIL

Mobile full-screen:
PASS/FAIL

PF/PJ:
PASS/FAIL

CPF/CNPJ:
PASS/FAIL

Grupo:
PASS/FAIL

Empresa:
PASS/FAIL

Vendedor:
PASS/FAIL

Financeiro:
PASS/FAIL

Contatos:
PASS/FAIL

Google:
PASS/FAIL

Cadastro ERP:
PASS/FAIL

Confirmação:
PASS/FAIL

newOrderFromClient:
PASS/FAIL

CREATE pedido:
PASS/FAIL

EDIT pedido:
PASS/FAIL

Google Maps Entrega:
PASS/FAIL

APP-XXXX:
PASS/FAIL

Paginação:
PASS/FAIL

Cards:
PASS/FAIL

==================================================
35. RELATÓRIO FINAL
==================================================

Informar:

ARQUIVOS FRONTEND ALTERADOS:

ARQUIVOS NODE ALTERADOS:

CUSTOMER GROUP QUERY:
CORRIGIDA SIM/NÃO

COLUNA INATIVO REMOVIDA:
SIM/NÃO

GRUPOS CARREGANDO:
SIM/NÃO

EMPRESA EDITÁVEL:
SIM/NÃO

EMPRESA SINCRONIZADA COM WIZARD:
SIM/NÃO

GRUPO LIMPO NA TROCA DE EMPRESA:
SIM/NÃO

GOOGLE AUTOCOMPLETE:
FUNCIONANDO SIM/NÃO

LOCATION RESTRICTION:
LATLNGBOUNDS SIM/NÃO

HAVERSINE:
PRESERVADO SIM/NÃO

RAIO:
50000 METROS

GEOCODING LIBRARY:
SIM/NÃO

ENDEREÇO MANUAL:
VALIDADO SIM/NÃO

TIPO VENDA NO CLIENTE:
NÃO

ID_OPERACAO:
NULL

LATLONG ERP:
NULL

VENDEDOR AUTOMÁTICO:
SIM/NÃO

FINANCEIRO PRESERVADO:
SIM/NÃO

SHEET GLOBAL:
SIM/NÃO

BOTÕES NOVO CLIENTE:
1

NODE ALTERADO:
SIM

PACKAGE.JSON ALTERADO:
SIM/NÃO

NPM INSTALL NECESSÁRIO:
SIM/NÃO

REGRESSÕES:

PENDÊNCIAS:`

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="p-8 font-mono text-sm whitespace-pre-wrap">
      {content}
    </div>
  )
}
