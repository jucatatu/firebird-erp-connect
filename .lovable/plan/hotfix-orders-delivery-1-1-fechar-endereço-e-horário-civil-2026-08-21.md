# HOTFIX ORDERS DELIVERY.1.1 — FECHAR ENDEREÇO E HORÁRIO CIVIL

&nbsp;

## OBJETIVO

&nbsp;

Completar HOTFIX ORDERS DELIVERY.1 antes da homologação Firebird.

&nbsp;

Já está correto:

&nbsp;

- deliveryAddress chega ao Node;

- deliveryAddressSource chega ao Node;

- deliveryAt não é mais truncado;

- returnAt não é mais truncado;

- mapper já consegue usar endereço custom.

&nbsp;

Corrigir:

&nbsp;

1. custom inválido NÃO pode cair no endereço cadastral;

2. cliente com cadastro incompleto pode usar custom válido;

3. horário deve ser validado como horário CIVIL local;

4. CEP formatado deve ser aceito e normalizado;

5. reverter alteração indevida em auditoria-produtos.

&nbsp;

NÃO usar Fast Visual Edit.

&nbsp;

==================================================

1. FRONTEND

==================================================

&nbsp;

Preservar em:

&nbsp;

src/lib/erp-orders.functions.ts

&nbsp;

deliveryAt: input.deliveryAt

returnAt: input.returnAt || null

deliveryAddress

deliveryAddressConfirmed

deliveryAddressSource

&nbsp;

NÃO usar split("T").

NÃO usar toISOString().

NÃO converter para UTC.

&nbsp;

Alterar somente se necessário.

&nbsp;

==================================================

2. VALIDATE CLIENT

==================================================

&nbsp;

Em:

&nbsp;

erp-api/src/modules/orders/orders.service.js

&nbsp;

validateClient(clientId)

&nbsp;

deve validar o CLIENTE, não o endereço de entrega.

&nbsp;

Remover a rejeição atual baseada em:

&nbsp;

client.address.city

client.address.state

&nbsp;

Continuar garantindo que o cliente exista.

&nbsp;

Não inventar nova regra de status/inativo se ela não fazia

parte do fluxo atual.

&nbsp;

==================================================

3. RESOLVER ENDEREÇO

==================================================

&nbsp;

Criar helper dedicado:

&nbsp;

resolveDeliveryAddress(payload, client)

&nbsp;

A resolução acontece no Service ANTES do mapper.

&nbsp;

==================================================

4. PEDIDO DE ENTREGA

==================================================

&nbsp;

Somente quando:

&nbsp;

payload.deliver === true

&nbsp;

é obrigatório resolver/validar endereço.

&nbsp;

Se:

&nbsp;

deliveryAddressSource === "custom"

&nbsp;

deliveryAddress é obrigatório.

&nbsp;

Campos mínimos:

&nbsp;

street

number

neighborhood

city

state

postalCode

&nbsp;

Se faltar qualquer campo:

&nbsp;

AppError

&nbsp;

code:

DELIVERY_ADDRESS_INCOMPLETE

&nbsp;

statusCode:

422

&nbsp;

retryable:

false

&nbsp;

NUNCA fazer fallback para client.address

quando source="custom".

&nbsp;

==================================================

5. SOURCE CLIENT

==================================================

&nbsp;

Se:

&nbsp;

deliveryAddressSource === "client"

&nbsp;

ou source ausente para compatibilidade:

&nbsp;

usar:

&nbsp;

client.address

&nbsp;

Aceitar a estrutura cadastral existente:

&nbsp;

street

number

district

city

state

zip/postalCode

complement

&nbsp;

Se endereço cadastral estiver incompleto:

&nbsp;

CLIENT_ADDRESS_INCOMPLETE

status 422.

&nbsp;

==================================================

6. RETIRADA

==================================================

&nbsp;

Se:

&nbsp;

payload.deliver === false

&nbsp;

não bloquear o pedido por endereço de entrega.

&nbsp;

Preservar:

&nbsp;

ENTREGAR = NULL.

&nbsp;

Não exigir custom/client address para retirada somente

porque campos antigos vieram no payload.

&nbsp;

==================================================

7. NORMALIZAÇÃO

==================================================

&nbsp;

O helper deve devolver uma estrutura canônica:

&nbsp;

{

  street,

  number,

  district,

  city,

  state,

  zip,

  complement

}

&nbsp;

Mapear custom:

&nbsp;

neighborhood → district

postalCode → zip

&nbsp;

Aplicar:

&nbsp;

trim em strings.

&nbsp;

CEP:

&nbsp;

String(value)

.replace(/\D/g, "")

.slice(0, 8)

&nbsp;

UF:

trim/uppercase quando apropriado.

&nbsp;

Não alterar significado do endereço.

&nbsp;

==================================================

8. VALIDATOR ZOD

==================================================

&nbsp;

Manter bodySchema `.strict()`.

&nbsp;

deliveryAddress continua opcional para compatibilidade.

&nbsp;

IMPORTANTE:

&nbsp;

postalCode NÃO pode usar simplesmente:

&nbsp;

.max(LIMITS.CEP)

&nbsp;

antes da normalização.

&nbsp;

Deve aceitar pelo menos:

&nbsp;

89250000

89250-000

&nbsp;

Preferência:

&nbsp;

schema aceita CEP com ou sem máscara

e Service normaliza para 8 dígitos.

&nbsp;

Pode usar validação equivalente a:

&nbsp;

8 dígitos

ou

XXXXX-XXX

&nbsp;

Não usar z.any().

&nbsp;

==================================================

9. CREATE ORDER

==================================================

&nbsp;

Em createOrderTransactional:

&nbsp;

const client = await validateClient(...)

&nbsp;

const deliveryAddress =

  resolveDeliveryAddress(payload, client)

&nbsp;

Passar ao mapper:

&nbsp;

buildCompleteProcParams({

  payload,

  companyId,

  clientContext: client,

  deliveryAddress,

  totals

})

&nbsp;

==================================================

10. UPDATE ORDER

==================================================

&nbsp;

Aplicar EXATAMENTE a mesma regra em updateOrder().

&nbsp;

Criação e edição devem compartilhar:

&nbsp;

resolveDeliveryAddress()

&nbsp;

Não duplicar regras diferentes.

&nbsp;

==================================================

11. MAPPER

==================================================

&nbsp;

Alterar assinatura para receber:

&nbsp;

deliveryAddress

&nbsp;

O mapper deve consumir o endereço já resolvido.

&nbsp;

Não deixar nele a decisão:

&nbsp;

custom vs client.

&nbsp;

Preferência:

&nbsp;

const addr =

  deliveryAddress ||

  clientContext?.address ||

  {}

&nbsp;

O fallback clientContext pode existir somente

para compatibilidade interna legada.

&nbsp;

O fluxo normal create/update deve sempre passar

o endereço resolvido quando deliver=true.

&nbsp;

==================================================

12. FIREBIRD

==================================================

&nbsp;

Preservar:

&nbsp;

SP_CAD_ORDEM_VENDA_COMPLETO

&nbsp;

e exatamente seus 30 parâmetros.

&nbsp;

Somente alimentar corretamente:

&nbsp;

14 UF

15 CIDADE

16 BAIRRO

17 RUA

18 NUMERO

19 COMP

20 CEP

&nbsp;

ZERO mudança na procedure.

&nbsp;

==================================================

13. HORÁRIO CIVIL

==================================================

&nbsp;

Preservar toDateCivil().

&nbsp;

Input principal de teste:

&nbsp;

2026-08-21T09:37

&nbsp;

Esperado:

&nbsp;

getFullYear() === 2026

getMonth() === 7

getDate() === 21

getHours() === 9

getMinutes() === 37

&nbsp;

NÃO usar getUTCHours() como prova do requisito.

&nbsp;

NÃO usar "Z" no teste principal.

&nbsp;

==================================================

14. SEGUNDO TESTE CIVIL

==================================================

&nbsp;

Input:

&nbsp;

2026-08-21T16:45

&nbsp;

Esperado local:

&nbsp;

16:45

&nbsp;

Não pode virar:

&nbsp;

12:00

13:45

19:45

ou horário dependente de UTC.

&nbsp;

==================================================

15. TESTE DE TIMEZONE

==================================================

&nbsp;

Se testar timezone explicitamente:

&nbsp;

executar o teste/processo Node com TZ definido antes

da inicialização, por exemplo:

&nbsp;

TZ=America/Sao_Paulo

&nbsp;

ou abordagem equivalente compatível com o ambiente.

&nbsp;

O requisito é horário civil informado pelo usuário,

não instante UTC.

&nbsp;

==================================================

16. DATA LEGADA

==================================================

&nbsp;

Para chamada antiga que envie apenas:

&nbsp;

YYYY-MM-DD

&nbsp;

o fallback atual de 12:00 pode permanecer.

&nbsp;

Mas qualquer input com HH:mm deve preservar HH:mm.

&nbsp;

==================================================

17. RETURN AT

==================================================

&nbsp;

Testar:

&nbsp;

2026-08-23T11:20

&nbsp;

Esperado:

&nbsp;

DATA_PREV_RETORNO

11:20 local.

&nbsp;

Não truncar.

&nbsp;

==================================================

18. TESTES DE ENDEREÇO

==================================================

&nbsp;

A) Cadastro:

Rua A, 100

&nbsp;

Custom:

Rua B, 500

&nbsp;

source=custom

deliver=true

&nbsp;

→ procedure usa Rua B, 500.

&nbsp;

B) custom + address null

&nbsp;

→ DELIVERY_ADDRESS_INCOMPLETE.

&nbsp;

C) custom + cidade ausente

&nbsp;

→ DELIVERY_ADDRESS_INCOMPLETE.

&nbsp;

D) cadastro incompleto + custom completo

&nbsp;

→ permitido.

&nbsp;

E) source=client + cadastro completo

&nbsp;

→ usa cadastro.

&nbsp;

F) source=client + cadastro incompleto

&nbsp;

→ CLIENT_ADDRESS_INCOMPLETE.

&nbsp;

G) CEP custom:

&nbsp;

89250-000

&nbsp;

→ procedure recebe:

&nbsp;

89250000

&nbsp;

H) updateOrder também usa custom corretamente.

&nbsp;

I) retirada com cadastro incompleto:

&nbsp;

deliver=false

&nbsp;

→ endereço não bloqueia a ordem.

&nbsp;

==================================================

19. ENTREGAR

==================================================

&nbsp;

Preservar rigorosamente:

&nbsp;

deliver=true

→ ENTREGAR=1

&nbsp;

deliver=false

→ ENTREGAR=NULL

&nbsp;

Não alterar essa regra.

&nbsp;

==================================================

20. AUDITORIA-PRODUTOS

==================================================

&nbsp;

Reverter a alteração indevida em:

&nbsp;

src/routes/auditoria-produtos.tsx

&nbsp;

ATENÇÃO:

&nbsp;

o estado anterior correto NÃO é:

&nbsp;

"Execute esta instrucao no projeto: Parar"

&nbsp;

Restaurar exatamente o conteúdo anterior ao HOTFIX,

que começava com:

&nbsp;

"Execute esta instrucao no projeto:

AUDITORIA READ-ONLY — BUSCA DE PRODUTOS COM FALSOS POSITIVOS"

&nbsp;

Não alterar mais nada nesse arquivo.

&nbsp;

==================================================

21. TESTABILIDADE

==================================================

&nbsp;

Testar resolveDeliveryAddress diretamente se possível.

&nbsp;

Se necessário, exportar helper de forma controlada para testes,

sem criar endpoint público.

&nbsp;

Alternativamente testar pelo service com mocks.

&nbsp;

Não testar somente mapper, porque a regra de erro/fallback

agora pertence ao Service.

&nbsp;

==================================================

22. NÃO ALTERAR

==================================================

&nbsp;

Preservar:

&nbsp;

sellerId

company scope

preços

pagamentos

itens

equipamentos

idempotência

status inicial 27

espelho Supabase

Novo Cliente

Catálogo

Mapa

Permissões

&nbsp;

ZERO migration Supabase.

ZERO alteração SQL Firebird.

ZERO alteração de procedure.

&nbsp;

==================================================

23. ARQUIVOS ESPERADOS

==================================================

&nbsp;

erp-api/src/modules/orders/orders.service.js

erp-api/src/modules/orders/orders.mapper.js

erp-api/src/modules/orders/orders.validator.js

erp-api/tests/hotfix-delivery-address.test.js

&nbsp;

Possível:

src/lib/erp-orders.functions.ts

&nbsp;

Reverter:

src/routes/auditoria-produtos.tsx

&nbsp;

==================================================

24. CRITÉRIOS DE ACEITE

==================================================

&nbsp;

[ ] custom completo grava custom

[ ] custom inválido não faz fallback

[ ] cadastro incompleto + custom funciona

[ ] source client usa cadastro

[ ] retirada não exige endereço

[ ] CEP com máscara é aceito

[ ] CEP chega com 8 dígitos

[ ] create correto

[ ] update correto

[ ] deliveryAt preserva hora civil

[ ] returnAt preserva hora civil

[ ] ENTREGAR continua 1/NULL

[ ] seller não mudou

[ ] procedure não mudou

[ ] auditoria-produtos restaurado corretamente

[ ] testes passam

[ ] typecheck passa

[ ] build passa

[ ] zero migrations

[ ] NÃO usar Fast Visual Edit

&nbsp;

==================================================

25. FINAL

==================================================

&nbsp;

Após implementar:

&nbsp;

PARAR.

&nbsp;

NÃO atualizar ainda:

&nbsp;

C:\ERP-API-V2

&nbsp;

Aguardar revisão Git.

&nbsp;

Somente após aprovação:

&nbsp;

git pull no Windows

reiniciar Node

homologar no Firebird.

&nbsp;

Teste real final:

&nbsp;

cliente cadastrado no endereço A

pedido com endereço custom B

horário 09:37

&nbsp;

Esperado:

&nbsp;

Firebird = endereço B

DATA_PREV_ENTREGA = 09:37

ENTREGAR = 1.

&nbsp;

PARAR.