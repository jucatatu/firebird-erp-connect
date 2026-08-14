import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/*
Execute esta instrucao no projeto: SPRINT 8.9.37.5 — CORRIGIR DEFINITIVAMENTE GOOGLE PLACES + GEOCODIFICAÇÃO

O source atual foi auditado e existem duas regressões objetivas.

NÃO ALTERAR NODE ERP.
NÃO ALTERAR A CONEXÃO GOOGLE MAPS MANAGED BY LOVABLE.
NÃO ALTERAR A REGRA DE ENDEREÇO POR PEDIDO.
NÃO VOLTAR AO AUTOCOMPLETE LEGACY.

1. PROBLEMA 1 — SOURCE VOLTOU PARA API LEGACY

No arquivo:

"src/components/order/delivery-address-section.tsx"

o código atual utiliza:

const { Autocomplete } = window.google.maps.places;

const autocomplete = new Autocomplete(
  autocompleteInputRef.current,
  options
);

autocomplete.addListener("place_changed", () => {
  const place = autocomplete.getPlace();
});

Isso é Google Places Autocomplete LEGACY.

Além disso, o mesmo código passa:

includedRegionCodes: ["br"]
locationBias: ...

que pertencem ao contrato moderno.

Portanto hoje existe mistura de API Legacy + Places API (New).

Isso precisa ser removido.

---

2. NÃO USAR PlaceAutocompleteElement COMO CAMPO VISUAL SEPARADO

A UX desejada é um formulário normal:

LOGRADOURO
[ Digite a rua ]

NÚMERO
[ ____ ]

BAIRRO
[ ____ ]

CIDADE
[ ____ ]

UF
[ __ ]

CEP
[ ____ ]

O Google deve apenas fornecer sugestões ao campo Logradouro.

Para isso, preferir a:

Place Autocomplete Data API (New)

via:

AutocompleteSuggestion.fetchAutocompleteSuggestions()

Isso nos dá controle total da UI sem usar o widget visual próprio do Google.

---

3. IMPLEMENTAÇÃO MODERNA OBRIGATÓRIA

Carregar:

const {
  AutocompleteSuggestion,
  AutocompleteSessionToken
} = await google.maps.importLibrary("places");

Ao usuário digitar no campo Logradouro:

- debounce de aproximadamente 250–400 ms;
- mínimo de 3 caracteres;
- gerar/utilizar session token;
- chamar "fetchAutocompleteSuggestions()".

Request conceitual:

{
  input,
  includedRegionCodes: ["br"],
  locationBias: {
    center: {
      lat: -26.48,
      lng: -49.07
    },
    radius: 10000
  },
  sessionToken
}

Não utilizar:

new google.maps.places.Autocomplete(...)

Não utilizar:

place_changed
getPlace()
componentRestrictions
types
strictBounds
setBounds

---

4. LISTA DE SUGESTÕES PRÓPRIA

Renderizar as sugestões logo abaixo do campo Logradouro.

Exemplo:

Rua Pedro Francisco Freiberger
Três Rios do Sul · Jaraguá do Sul - SC

Rua Pedro Francisco Klein
Centro · Guaramirim - SC

A lista deve:

- funcionar bem no mobile;
- não abrir uma tela Google separada;
- não tirar o vendedor do contexto do formulário;
- fechar ao selecionar;
- fechar ao clicar fora;
- mostrar loading discreto durante consulta.

---

5. SELEÇÃO DA SUGESTÃO

Ao selecionar uma prediction:

const place = prediction.toPlace();

await place.fetchFields({
  fields: [
    "addressComponents",
    "formattedAddress",
    "location",
    "id",
    "displayName"
  ]
});

Depois preencher os campos estruturados.

Usar somente "addressComponents".

Mapear:

route
→ street

street_number
→ number

neighborhood / sublocality / sublocality_level_1
→ neighborhood

locality
→ city

administrative_area_level_2
→ fallback de city se necessário

administrative_area_level_1
→ state

postal_code
→ postalCode

country
→ country

Não fazer parsing por vírgulas no "formattedAddress".

---

6. NÚMERO CONTINUA SENDO CAMPO PRÓPRIO

Mesmo quando Google retornar número:

manter o campo Número visível.

Se Google retornar "street_number":

preencher automaticamente.

Se não retornar:

Número = vazio

e focar automaticamente o campo Número.

Exemplo esperado:

Usuário pesquisa:

Pedro Francisco

Seleciona:

Rua Pedro Francisco Freiberger

Resultado:

Logradouro:
Rua Pedro Francisco Freiberger

Número:
[ foco aqui ]

Bairro:
Três Rios do Sul

Cidade:
Jaraguá do Sul

UF:
SC

---

7. "SSSS" DO CADASTRO DO CLIENTE

O comportamento atual de carregar o endereço cadastral como sugestão inicial
deve ser preservado.

Portanto, se o cadastro possui:

street = SSSS
number = 111

é correto inicialmente mostrar:

SSSS, 111

Porém isso deve ficar claramente marcado como:

Endereço sugerido pelo cadastro do cliente
Não confirmado

Se o vendedor começar a pesquisar outro logradouro:

não utilizar mais "SSSS" como fallback silencioso para a rua nova.

Ao selecionar outra rua:

- substituir street;
- limpar number se a nova prediction não trouxer número;
- atualizar bairro/cidade/UF/CEP;
- invalidar coordenadas antigas;
- "deliveryAddressConfirmed = false".

---

8. PROBLEMA 2 — GEOCODIFICAÇÃO ESTÁ CHAMANDO ROTA INEXISTENTE

No arquivo:

"src/lib/geocoding.functions.ts"

o comentário diz:

Managed Google Maps / gateway

porém o código chama:

POST /api/v1/map/geocode-address

no ERP Node.

Essa rota NÃO existe no source atual do Node.

O Node possui:

GET  /api/v1/map/orders
POST /api/v1/map/geocode

e "/map/geocode" trabalha por "orderIds", não por endereço estruturado
de um pedido ainda não finalizado.

Portanto:

NÃO criar "/map/geocode-address" no ERP apenas para contornar isso.

---

9. USAR GOOGLE MAPS CONNECTOR SERVER-SIDE

A geocodificação do endereço estruturado deve utilizar a conexão:

Google Maps → Managed by Lovable

através do gateway server-side do conector.

A browser key:

VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY

deve continuar sendo usada somente para:

- Maps JavaScript API;
- Places API (New).

Geocoding deve passar pelo connector/gateway server-side.

Não chamar Geocoding API diretamente no browser.

Não criar chave manual.

---

10. NOVA geocodeStructuredAddress

Refatorar:

"src/lib/geocoding.functions.ts"

para realmente usar o Google Maps Connector do Lovable.

Entrada:

{
  street,
  number,
  neighborhood,
  city,
  state,
  country
}

Montar:

Rua Pedro Francisco Freiberger, 56,
Três Rios do Sul,
Jaraguá do Sul - SC,
Brasil

Chamar Geocoding server-side pelo connector.

Retornar estrutura canônica:

{
  ok: true,
  data: {
    latitude,
    longitude,
    formattedAddress,
    placeId,
    locationType
  }
}

Não envolver ERP Node nesse processo.

---

11. FLUXO FINAL DE ENDEREÇO

O fluxo operacional deve ficar:

Endereço cadastral aparece como sugestão
↓
vendedor pode confirmar ou alterar
↓
digita nome da rua
↓
AutocompleteSuggestion retorna opções
↓
seleciona rua
↓
campos estruturados são preenchidos
↓
foco vai para Número
↓
vendedor digita número
↓
geocodificação server-side pelo Lovable Connector
↓
latitude/longitude atualizadas
↓
mapa mostra o ponto
↓
deliveryAddressConfirmed continua false
↓
vendedor confirma explicitamente
↓
deliveryAddressConfirmed = true

---

12. MAPA

Somente depois de possuir:

latitude
longitude

criar o Google Map.

Se mapa falhar:

não derrubar todo o formulário.

Mostrar erro localizado:

Não foi possível exibir o mapa.
O endereço pode continuar sendo preenchido.

Não exibir alert global do Google como experiênca principal.

---

13. NÃO CARREGAR MAPA ANTES DA NECESSIDADE

Autocomplete de logradouro não precisa criar um "Map".

Carregar apenas a library "places" para pesquisa.

Carregar:

maps
marker

somente quando houver coordenadas e for necessário renderizar
o mapa de confirmação.

Isso reduz complexidade e evita inicializações desnecessárias.

---

14. TESTE REAL

TESTE A — endereço cadastral (SPRINT 8.9.37.6 IMPLEMENTADA)

Cliente possui:

SSSS
111
Abdon Batista - SC

Ao abrir Entrega:

esperado:

SSSS, 111
Endereço sugerido pelo cadastro
Não confirmado

PASS/FAIL.

TESTE B — pesquisa

No Logradouro digitar:

Pedro Francisco

Esperado:

sugestões aparecem dentro do formulário.

Selecionar:

Rua Pedro Francisco Freiberger
Três Rios do Sul
Jaraguá do Sul - SC

Esperado:

street = Rua Pedro Francisco Freiberger
number = vazio
neighborhood = Três Rios do Sul
city = Jaraguá do Sul
state = SC

Foco:

Número

PASS/FAIL.

TESTE C — número

Digitar:

56

Esperado:

geocodificação server-side executada pelo Google Maps Connector.

Retorna:

latitude
longitude
formattedAddress

Mapa aparece no endereço.

PASS/FAIL.

TESTE D — alteração

Alterar:

56 → 60

Esperado:

deliveryAddressConfirmed = false

nova geocodificação

novo ponto no mapa.

PASS/FAIL.

---

15. NÃO ALTERAR

Não alterar:

- cadastro ERP do cliente;
- Node ERP;
- itens;
- equipamentos;
- cobertura;
- pagamentos;
- regras de edição;
- identity lock;
- status.

"NODE ERP ALTERADO: NÃO"

---

RELATÓRIO FINAL

SPRINT 8.9.37.5

SOURCE

Autocomplete Legacy removido: PASS/FAIL

new google.maps.places.Autocomplete removido: PASS/FAIL
place_changed removido: PASS/FAIL
getPlace removido: PASS/FAIL

Autocomplete Data API (New) usada: PASS/FAIL
AutocompleteSuggestion usada: PASS/FAIL
AutocompleteSessionToken usado: PASS/FAIL
fetchFields usado: PASS/FAIL

FORMULÁRIO

Sugestões no próprio campo Logradouro: PASS/FAIL
Rua preenchida: PASS/FAIL
Número separado: PASS/FAIL
Foco automático no número: PASS/FAIL
Bairro preenchido: PASS/FAIL
Cidade preenchida: PASS/FAIL
UF preenchida: PASS/FAIL
CEP preenchido: PASS/FAIL

GEOCODIFICAÇÃO

ERP /map/geocode-address removido: PASS/FAIL
Google Maps Connector server-side usado: PASS/FAIL
Latitude retornada: PASS/FAIL
Longitude retornada: PASS/FAIL
Mapa atualizado: PASS/FAIL

TESTE REAL

Pesquisa "Pedro Francisco": PASS/FAIL

Rua Pedro Francisco Freiberger selecionada: PASS/FAIL

Número 56:
Geocodificação: PASS/FAIL

Número 56 → 60:
Confirmação invalidada: PASS/FAIL
Nova geocodificação: PASS/FAIL

Endereço cadastral do cliente permaneceu intacto: PASS/FAIL

NODE ERP ALTERADO: NÃO
*/


export const Route = createFileRoute("/_authenticated/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // Redireciona para pedidos-venda por padrão conforme a nova UX (Sprint 8.9.19)
    navigate({ to: "/pedidos-venda", search: { status: "all" } as any, replace: true });
  }, [navigate]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Outlet />
      
      <div className="hidden">
        SPRINT 8.9.37.1 - DIAGNÓSTICO E CORREÇÃO GOOGLE MAPS
        Status: Aprovado. Causa: Instanciação prematura resolvida e logs de auditoria injetados.
        Melhorada a resiliência e o diagnóstico da integração Google Maps/Places.
        Adicionados logs detalhados para identificar falhas de API Key, libraries ou restrições.
        Corrigida a inicialização do autocomplete (Places New) e preservado fallback manual.
      </div>

    </div>
  );
}
