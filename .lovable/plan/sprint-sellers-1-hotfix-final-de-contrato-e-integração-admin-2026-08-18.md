# SPRINT SELLERS.1 — HOTFIX FINAL DE CONTRATO E INTEGRAÇÃO ADMINISTRATIVA

# PLANO COMPLETO CONSOLIDADO

&nbsp;

## OBJETIVO

&nbsp;

Corrigir exclusivamente os problemas encontrados na revisão Git após a implementação inicial do módulo Sellers, garantindo:

&nbsp;

1. contrato consistente entre ERP API Node e frontend;

2. isolamento completo do módulo Sellers;

3. restauração integral da lógica de Pedidos anterior à Sprint Sellers;

4. tratamento correto de indisponibilidade do ERP;

5. validação rigorosa de `erpSellerId`;

6. validação do Seller ANTES do envio de convite;

7. compatibilidade Seller × Empresa;

8. testes automatizados que realmente comprovem os contratos;

9. preparação para homologação final no Firebird real.

&nbsp;

O schema Firebird de Sellers JÁ FOI DESCOBERTO E HOMOLOGADO.

&nbsp;

Esta sprint NÃO deve redescobrir o schema.

&nbsp;

==================================================

1. ESCOPO E REGRAS DE NÃO ALTERAÇÃO

==================================================

&nbsp;

NÃO alterar:

&nbsp;

- Mapa;

- rota `/`;

- `/operations`;

- Novo Cliente;

- edição de Cliente;

- Novo Pedido;

- edição de Pedido;

- Entregas;

- Recolhas;

- Aprovações;

- Produtos;

- Equipamentos;

- Pricing;

- Payment Options;

- Catálogo;

- geocodificação;

- sistema de permissões;

- PermissionGate;

- PermissionAction;

- has_permission;

- has_role;

- RPCs administrativas;

- migrations Supabase.

&nbsp;

NÃO iniciar Sprint 8.9.43.2.

&nbsp;

NÃO usar Fast Visual Edit.

&nbsp;

ZERO escrita Firebird.

&nbsp;

==================================================

2. SCHEMA FIREBIRD JÁ HOMOLOGADO

==================================================

&nbsp;

Preservar exatamente o schema comprovado no Firebird real.

&nbsp;

Tabela:

&nbsp;

COLABORADORES

&nbsp;

Campos utilizados:

&nbsp;

- ID_COLABORADORES

- ID_PESSOA

- ID_EMPRESA

- IS_VENDEDOR

&nbsp;

Tabela:

&nbsp;

PESSOAS

&nbsp;

Campos utilizados:

&nbsp;

- ID_PESSOA

- NOME

- APELIDO

&nbsp;

Relacionamento:

&nbsp;

COLABORADORES.ID_PESSOA

→ PESSOAS.ID_PESSOA

&nbsp;

ID real do Seller:

&nbsp;

COLABORADORES.ID_COLABORADORES

&nbsp;

Esse é o valor que deve ser persistido em:

&nbsp;

profiles.erp_seller_id

&nbsp;

NÃO utilizar:

&nbsp;

ID_PESSOA

&nbsp;

como Seller ID.

&nbsp;

==================================================

3. REGRA DE IDENTIFICAÇÃO DO VENDEDOR

==================================================

&nbsp;

A única condição homologada nesta sprint é:

&nbsp;

c.IS_VENDEDOR = 1

&nbsp;

E empresas permitidas:

&nbsp;

c.ID_EMPRESA IN (1,3)

&nbsp;

Onde:

&nbsp;

1 = GRAAL

3 = GROTT

&nbsp;

NÃO adicionar filtros não homologados como:

&nbsp;

INATIVO = 0

DELETED = 0

DEMISSAO IS NULL

PESSOAS.DELETED = 0

&nbsp;

Esses campos foram apenas inspecionados.

&nbsp;

Eles NÃO são regra de negócio homologada nesta sprint.

&nbsp;

==================================================

4. BACKEND ERP — REPOSITORY SELLERS

==================================================

&nbsp;

Preservar:

&nbsp;

erp-api/src/modules/sellers/sellers.repository.js

&nbsp;

Implementação deve permanecer baseada em:

&nbsp;

SELECT

    c.ID_COLABORADORES AS ID_VENDEDOR,

    c.ID_EMPRESA AS ID_EMPRESA,

    p.NOME AS NOME,

    p.APELIDO AS APELIDO

FROM COLABORADORES c

JOIN PESSOAS p

    ON p.ID_PESSOA = c.ID_PESSOA

WHERE c.IS_VENDEDOR = 1

  AND c.ID_EMPRESA IN (1,3)

&nbsp;

Implementar/preservar:

&nbsp;

searchSellers({

  query,

  limit,

  companyId

})

&nbsp;

e:

&nbsp;

getSellerById(id)

&nbsp;

Toda entrada variável deve ser parametrizada.

&nbsp;

PROIBIDO concatenar diretamente no SQL:

&nbsp;

- q;

- companyId;

- id;

- qualquer valor vindo do usuário.

&nbsp;

==================================================

5. CONTRATO JSON — CORREÇÃO OBRIGATÓRIA

==================================================

&nbsp;

O contrato compartilhado do frontend espera respostas ERP no padrão:

&nbsp;

{

  success: true,

  data: ...

}

&nbsp;

Portanto Sellers deve obedecer a esse contrato.

&nbsp;

NÃO alterar globalmente `callErp()` para entender `seller` ou `sellers` fora de `data`.

&nbsp;

Corrigir o controller Sellers.

&nbsp;

GET /api/v1/sellers

&nbsp;

deve responder:

&nbsp;

{

  "success": true,

  "data": {

    "sellers": [

      {

        "id": 1,

        "name": "NOME",

        "nickname": "APELIDO",

        "companyId": 1

      }

    ]

  }

}

&nbsp;

GET /api/v1/sellers/:id

&nbsp;

deve responder:

&nbsp;

{

  "success": true,

  "data": {

    "seller": {

      "id": 1,

      "name": "NOME",

      "nickname": "APELIDO",

      "companyId": 1

    }

  }

}

&nbsp;

==================================================

6. NÃO ALTERAR callErp()

==================================================

&nbsp;

Preservar funcionalmente:

&nbsp;

src/lib/erp.server.ts

&nbsp;

NÃO adicionar regras específicas como:

&nbsp;

parsed.seller

parsed.sellers

&nbsp;

ao parser genérico.

&nbsp;

NÃO alterar assinatura HMAC.

&nbsp;

NÃO alterar timeout global.

&nbsp;

NÃO alterar autenticação ERP.

&nbsp;

O módulo Sellers deve seguir o contrato existente.

&nbsp;

==================================================

7. ENDPOINT DE LISTAGEM

==================================================

&nbsp;

Preservar:

&nbsp;

GET /api/v1/sellers

&nbsp;

Preservar:

&nbsp;

authMiddleware

&nbsp;

Query params:

&nbsp;

q

limit

companyId

&nbsp;

q:

&nbsp;

- opcional;

- string;

- trim;

- pesquisa substring;

- pesquisa NOME e APELIDO.

&nbsp;

limit:

&nbsp;

- default 50;

- mínimo 1;

- máximo 100.

&nbsp;

companyId:

&nbsp;

- opcional;

- somente 1 ou 3.

&nbsp;

companyId inválido:

&nbsp;

HTTP 400.

&nbsp;

==================================================

8. ENDPOINT POR ID

==================================================

&nbsp;

Preservar/implementar:

&nbsp;

GET /api/v1/sellers/:id

&nbsp;

ID deve ser:

&nbsp;

inteiro positivo.

&nbsp;

ID inválido:

&nbsp;

HTTP 400.

&nbsp;

Seller inexistente:

&nbsp;

HTTP 404.

&nbsp;

Erro:

&nbsp;

SELLER_NOT_FOUND.

&nbsp;

Não mascarar erro de conexão ERP como 404.

&nbsp;

==================================================

9. ISOLAR SELLERS DO MÓDULO DE PEDIDOS

==================================================

&nbsp;

Criar módulo próprio:

&nbsp;

src/lib/erp-sellers.functions.ts

&nbsp;

Mover para esse arquivo:

&nbsp;

ErpSeller

&nbsp;

searchErpSellers

&nbsp;

getErpSellerDetail

&nbsp;

e qualquer helper exclusivamente relacionado a Sellers.

&nbsp;

Não manter Sellers dentro de:

&nbsp;

src/lib/erp-orders.functions.ts

&nbsp;

Atualizar imports em:

&nbsp;

- UserDialog;

- admin-users-invite.functions.ts;

- admin-users-update.functions.ts;

- testes relacionados.

&nbsp;

==================================================

10. RESTAURAR erp-orders.functions.ts

==================================================

&nbsp;

O arquivo:

&nbsp;

src/lib/erp-orders.functions.ts

&nbsp;

foi alterado indevidamente durante a Sprint Sellers.

&nbsp;

Restaurar integralmente o comportamento anterior à Sprint Sellers.

&nbsp;

Base de referência:

&nbsp;

commit:

&nbsp;

75a8ed9b1c61f49ff96472d19fc04deff8366a43

&nbsp;

A restauração deve preservar exatamente a lógica anterior de:

&nbsp;

- criação de pedido;

- edição de pedido;

- payload ERP;

- order_drafts;

- mirror;

- clientes;

- produtos;

- pricing;

- payment options;

- equipamentos;

- idempotência;

- regras de company access.

&nbsp;

Idealmente, depois da restauração:

&nbsp;

`erp-orders.functions.ts`

&nbsp;

não deve apresentar alterações funcionais decorrentes de Sellers.

&nbsp;

==================================================

11. REMOVER ARQUIVO TEMPORÁRIO

==================================================

&nbsp;

Excluir:

&nbsp;

src/lib/erp-orders.functions.ts.temp

&nbsp;

NÃO criar substitutos como:

&nbsp;

.temp

.bak

.old

.backup

&nbsp;

Nenhum arquivo temporário deve permanecer no Git.

&nbsp;

==================================================

12. MÓDULO FRONTEND SELLERS

==================================================

&nbsp;

Em:

&nbsp;

src/lib/erp-sellers.functions.ts

&nbsp;

criar/preservar interface:

&nbsp;

export interface ErpSeller {

  id: number;

  name: string;

  nickname: string | null;

  companyId: 1 | 3;

}

&nbsp;

Implementar:

&nbsp;

searchErpSellers()

&nbsp;

chamando:

&nbsp;

GET /api/v1/sellers

&nbsp;

E:

&nbsp;

getErpSellerDetail()

&nbsp;

chamando:

&nbsp;

GET /api/v1/sellers/:id

&nbsp;

Ambos server-side.

&nbsp;

Preservar autenticação da aplicação.

&nbsp;

==================================================

13. HELPER SERVER-SIDE DE VALIDAÇÃO

==================================================

&nbsp;

Criar helper server-only reutilizável, por exemplo:

&nbsp;

validateErpSellerForCompanies()

&nbsp;

Entrada:

&nbsp;

{

  erpSellerId: number | null,

  companies: Array<1 | 3>

}

&nbsp;

Comportamento:

&nbsp;

Se erpSellerId === null:

&nbsp;

retornar sucesso sem consultar ERP.

&nbsp;

Se houver Seller:

&nbsp;

consultar ERP API pelo ID.

&nbsp;

Validar:

&nbsp;

1. Seller existe;

2. companyId é 1 ou 3;

3. companyId pertence às empresas do usuário.

&nbsp;

==================================================

14. TRATAMENTO DE SELLER_NOT_FOUND

==================================================

&nbsp;

Somente converter para:

&nbsp;

SELLER_NOT_FOUND

&nbsp;

quando:

&nbsp;

status === 404

&nbsp;

OU:

&nbsp;

error.code === "SELLER_NOT_FOUND"

&nbsp;

Mensagem:

&nbsp;

"O vendedor selecionado não existe mais no ERP."

&nbsp;

NÃO converter qualquer `!ok` automaticamente para SELLER_NOT_FOUND.

&nbsp;

==================================================

15. TRATAMENTO DE ERP_UNAVAILABLE

==================================================

&nbsp;

Se ERP API responder:

&nbsp;

ERP_UNAVAILABLE

&nbsp;

ou status:

&nbsp;

500+

503

&nbsp;

ou erro retryable relacionado à indisponibilidade:

&nbsp;

lançar:

&nbsp;

ERP_UNAVAILABLE

&nbsp;

Mensagem:

&nbsp;

"Não foi possível consultar os vendedores no ERP neste momento. Tente novamente."

&nbsp;

==================================================

16. ERP_NETWORK_ERROR

==================================================

&nbsp;

Se `callErp()` retornar:

&nbsp;

ERP_NETWORK_ERROR

&nbsp;

tratar como indisponibilidade do ERP.

&nbsp;

Não transformar em SELLER_NOT_FOUND.

&nbsp;

Mensagem administrativa:

&nbsp;

"Não foi possível consultar os vendedores no ERP neste momento. Tente novamente."

&nbsp;

Code pode ser preservado como:

&nbsp;

ERP_NETWORK_ERROR

&nbsp;

ou normalizado para ERP_UNAVAILABLE, desde que o comportamento funcional permaneça distinto de Seller inexistente.

&nbsp;

==================================================

17. ERP_TIMEOUT

==================================================

&nbsp;

Se `callErp()` retornar:

&nbsp;

ERP_TIMEOUT

&nbsp;

tratar como indisponibilidade temporária.

&nbsp;

Não transformar em SELLER_NOT_FOUND.

&nbsp;

Mensagem:

&nbsp;

"Não foi possível consultar os vendedores no ERP neste momento. Tente novamente."

&nbsp;

==================================================

18. SELLER_COMPANY_MISMATCH

==================================================

&nbsp;

Se Seller existe, mas:

&nbsp;

seller.companyId

&nbsp;

não pertence a:

&nbsp;

companies

&nbsp;

lançar:

&nbsp;

SELLER_COMPANY_MISMATCH

&nbsp;

Mensagem:

&nbsp;

"O vendedor ERP selecionado pertence a uma empresa que não está habilitada para este usuário."

&nbsp;

==================================================

19. SCHEMA ADMINISTRATIVO erpSellerId

==================================================

&nbsp;

Em Invite e Update usar:

&nbsp;

z.number().int().positive().nullable()

&nbsp;

Não aceitar:

&nbsp;

0

-1

1.5

NaN

strings arbitrárias.

&nbsp;

Não usar:

&nbsp;

if (data.erpSellerId)

&nbsp;

porque 0 é falsy.

&nbsp;

Usar:

&nbsp;

data.erpSellerId !== null

&nbsp;

ou o helper server-side.

&nbsp;

==================================================

20. FLUXO DO INVITE — CORREÇÃO CRÍTICA

==================================================

&nbsp;

Hoje nenhuma validação de Seller pode ocorrer DEPOIS de enviar o convite.

&nbsp;

Fluxo correto:

&nbsp;

1. autenticar usuário executor;

2. validar input;

3. requirePermission admin.users/create;

4. validar erpSellerId;

5. consultar Seller ERP;

6. validar empresa Seller × empresas do novo usuário;

7. somente se tudo estiver válido:

   chamar inviteUserByEmail();

8. obter newUserId;

9. chamar admin_setup_invited_user;

10. se a RPC falhar:

    executar compensação deleteUser(newUserId).

&nbsp;

IMPORTANTE:

&nbsp;

Se Seller for inválido:

&nbsp;

inviteUserByEmail NÃO pode ser chamado.

&nbsp;

Se ERP estiver indisponível:

&nbsp;

inviteUserByEmail NÃO pode ser chamado.

&nbsp;

Se empresa for incompatível:

&nbsp;

inviteUserByEmail NÃO pode ser chamado.

&nbsp;

==================================================

21. FLUXO UPDATE USER

==================================================

&nbsp;

Fluxo:

&nbsp;

1. autenticação;

2. requirePermission;

3. validação Zod;

4. se Seller != null:

   validar no ERP;

5. validar empresa;

6. chamar admin_update_user.

&nbsp;

Permitir:

&nbsp;

- Seller atual permanecer;

- Seller ser alterado;

- Seller ser removido;

- Seller null.

&nbsp;

Não buscar Seller quando:

&nbsp;

erpSellerId === null.

&nbsp;

==================================================

22. NÃO ALTERAR RPCs ADMINISTRATIVAS

==================================================

&nbsp;

Não alterar:

&nbsp;

admin_update_user

&nbsp;

admin_setup_invited_user

&nbsp;

LAST_ADMIN_PROTECTION

&nbsp;

INVALID_COMPANY_ACCESS

&nbsp;

INVALID_PERMISSION_PROFILE

&nbsp;

sincronização:

&nbsp;

Perfil Administrador ⇔ role admin

&nbsp;

company allowlist 1/3.

&nbsp;

NÃO criar migration.

&nbsp;

==================================================

23. USER DIALOG

==================================================

&nbsp;

Preservar o Combobox de Seller.

&nbsp;

Alterar import para:

&nbsp;

@/lib/erp-sellers.functions

&nbsp;

Exibir:

&nbsp;

NOME — GRAAL

&nbsp;

ou:

&nbsp;

NOME — GROTT

&nbsp;

Se nickname existir:

&nbsp;

pode aparecer como informação secundária.

&nbsp;

Seller continua opcional.

&nbsp;

==================================================

24. FILTRO DE SELLERS POR EMPRESA

==================================================

&nbsp;

Se formulário possui:

&nbsp;

[1]

&nbsp;

mostrar Sellers empresa 1.

&nbsp;

Se:

&nbsp;

[3]

&nbsp;

mostrar Sellers empresa 3.

&nbsp;

Se:

&nbsp;

[1,3]

&nbsp;

mostrar Sellers das duas.

&nbsp;

O frontend pode filtrar a lista para UX.

&nbsp;

O servidor deve validar novamente.

&nbsp;

==================================================

25. NÃO LIMPAR SELLER SILENCIOSAMENTE

==================================================

&nbsp;

Remover comportamento automático que faz:

&nbsp;

form.setValue("erpSellerId", null)

&nbsp;

quando empresas são alteradas.

&nbsp;

Se Seller selecionado ficar incompatível:

&nbsp;

manter valor atual.

&nbsp;

Bloquear salvamento.

&nbsp;

Mostrar mensagem clara.

&nbsp;

Usuário deverá escolher:

&nbsp;

- outro Seller;

- remover manualmente;

- restaurar empresa compatível.

&nbsp;

Nenhuma alteração silenciosa.

&nbsp;

==================================================

26. SELLER NULLABLE

==================================================

&nbsp;

Não tornar vendedor obrigatório globalmente.

&nbsp;

Permitir:

&nbsp;

erpSellerId = null

&nbsp;

para:

&nbsp;

- administradores;

- aprovadores;

- usuários não associados a vendedor;

- vendedores ainda sem vínculo, enquanto regra específica não existir.

&nbsp;

Não criar nesta sprint:

&nbsp;

role vendedor → Seller obrigatório.

&nbsp;

==================================================

27. PERSISTÊNCIA LOCAL

==================================================

&nbsp;

Única persistência local:

&nbsp;

profiles.erp_seller_id

&nbsp;

NÃO criar:

&nbsp;

sellers

erp_sellers

seller_profiles

seller_name

seller_company

seller_snapshot

&nbsp;

no Supabase.

&nbsp;

Firebird continua fonte de verdade.

&nbsp;

==================================================

28. ZERO ESCRITA FIREBIRD

==================================================

&nbsp;

Toda operação Sellers deve ser:

&nbsp;

SELECT.

&nbsp;

PROIBIDO:

&nbsp;

INSERT

UPDATE

DELETE

DDL

ALTER

DROP

EXECUTE PROCEDURE de escrita

&nbsp;

no Firebird.

&nbsp;

O vínculo é salvo somente no Supabase.

&nbsp;

==================================================

29. TESTES ERP API — NÃO DEPENDER DO FIREBIRD REAL

==================================================

&nbsp;

Criar testes automatizados determinísticos usando mocks/stubs apropriados.

&nbsp;

Os testes automatizados NÃO devem depender do Firebird real estar disponível.

&nbsp;

Cobrir:

&nbsp;

1. GET /sellers retorna:

   success.data.sellers

&nbsp;

2. GET /sellers/:id retorna:

   success.data.seller

&nbsp;

3. companyId=1;

&nbsp;

4. companyId=3;

&nbsp;

5. companyId=99 → 400;

&nbsp;

6. limit=0 → 400;

&nbsp;

7. limit=101 → 400;

&nbsp;

8. ID inválido → 400;

&nbsp;

9. Seller inexistente → 404;

&nbsp;

10. normalização:

    id

    name

    nickname

    companyId;

&nbsp;

11. busca q encaminhada corretamente;

&nbsp;

12. ERP_UNAVAILABLE propagado corretamente.

&nbsp;

Não aceitar:

&nbsp;

503

&nbsp;

como "quase sucesso" de teste funcional.

&nbsp;

503 deve ser testado como cenário de erro.

&nbsp;

==================================================

30. TESTES SERVER FUNCTIONS

==================================================

&nbsp;

Cobrir:

&nbsp;

- Seller null permitido;

- Seller válido;

- Seller company 1 para companies [1];

- Seller company 3 para [3];

- Seller company 1 para [1,3];

- Seller company 3 para [1,3];

- SELLER_NOT_FOUND;

- SELLER_COMPANY_MISMATCH;

- ERP_UNAVAILABLE;

- ERP_NETWORK_ERROR;

- ERP_TIMEOUT;

- erpSellerId 0 rejeitado;

- erpSellerId negativo rejeitado;

- erpSellerId decimal rejeitado.

&nbsp;

==================================================

31. TESTES CRÍTICOS DE INVITE

==================================================

&nbsp;

Adicionar teste:

&nbsp;

Seller inexistente

&nbsp;

→ inviteUserByEmail NÃO chamado.

&nbsp;

Adicionar:

&nbsp;

SELLER_COMPANY_MISMATCH

&nbsp;

→ inviteUserByEmail NÃO chamado.

&nbsp;

Adicionar:

&nbsp;

ERP_UNAVAILABLE

&nbsp;

→ inviteUserByEmail NÃO chamado.

&nbsp;

Adicionar:

&nbsp;

ERP_NETWORK_ERROR

&nbsp;

→ inviteUserByEmail NÃO chamado.

&nbsp;

Adicionar:

&nbsp;

ERP_TIMEOUT

&nbsp;

→ inviteUserByEmail NÃO chamado.

&nbsp;

Seller válido:

&nbsp;

→ valida Seller primeiro;

→ depois envia convite.

&nbsp;

==================================================

32. TESTES UPDATE

==================================================

&nbsp;

Cobrir:

&nbsp;

- manter Seller;

- trocar Seller;

- remover Seller;

- Seller null;

- Seller inválido;

- Seller de empresa incompatível;

- ERP offline.

&nbsp;

Confirmar que RPC:

&nbsp;

admin_update_user

&nbsp;

não é chamada quando validação Seller falha.

&nbsp;

==================================================

33. NÃO REGRESSÃO DE PEDIDOS

==================================================

&nbsp;

Após restaurar:

&nbsp;

src/lib/erp-orders.functions.ts

&nbsp;

rodar todos os testes existentes relacionados a:

&nbsp;

- Novo Pedido;

- criação ERP;

- edição ERP;

- clientes;

- pricing;

- payment options;

- produtos;

- equipamentos;

- order mirror;

- order_drafts.

&nbsp;

Sellers não pode modificar comportamento de Pedidos.

&nbsp;

==================================================

34. SCRIPT DE INSPEÇÃO SELLERS

==================================================

&nbsp;

Preservar:

&nbsp;

erp-api/scripts/inspect-sellers-schema.js

&nbsp;

Adicionar/preservar:

&nbsp;

require("dotenv").config();

&nbsp;

Execução direta:

&nbsp;

node scripts/inspect-sellers-schema.js

&nbsp;

Exit code:

&nbsp;

sucesso = 0

erro = 1

&nbsp;

Continuar somente leitura.

&nbsp;

==================================================

35. FAST VISUAL EDIT

==================================================

&nbsp;

NÃO usar Fast Visual Edit.

&nbsp;

Não editar código técnico através de edição visual.

&nbsp;

Não gravar o prompt dentro de rotas ou arquivos de aplicação.

&nbsp;

Alterar somente os arquivos necessários através do fluxo normal de desenvolvimento.

&nbsp;

==================================================

36. TESTES E BUILD

==================================================

&nbsp;

Executar:

&nbsp;

ERP API:

&nbsp;

npm run check

npm test

&nbsp;

Frontend:

&nbsp;

testes

typecheck

build

&nbsp;

Se lint existir:

&nbsp;

lint.

&nbsp;

Informar números reais:

&nbsp;

passed

failed

skipped.

&nbsp;

==================================================

37. HOMOLOGAÇÃO FIREBIRD REAL É ETAPA POSTERIOR

==================================================

&nbsp;

O Lovable NÃO deve declarar homologação final apenas pelos testes automatizados.

&nbsp;

Após esta implementação o status obrigatório é:

&nbsp;

SELLERS IMPLEMENTADO — AGUARDANDO HOMOLOGAÇÃO LOCAL FIREBIRD

&nbsp;

A homologação real será feita depois da publicação e revisão do Git na máquina:

&nbsp;

C:\ERP-API-V2

&nbsp;

com o Firebird real.

&nbsp;

==================================================

38. TESTES QUE SERÃO FEITOS NA HOMOLOGAÇÃO LOCAL

==================================================

&nbsp;

NÃO executar ficticiamente no ambiente Lovable se ele não possui acesso ao Firebird.

&nbsp;

Depois da revisão Git serão testados manualmente:

&nbsp;

GET /api/v1/sellers

&nbsp;

GET /api/v1/sellers?companyId=1

&nbsp;

GET /api/v1/sellers?companyId=3

&nbsp;

GET /api/v1/sellers?q=<nome real>

&nbsp;

GET /api/v1/sellers?q=<apelido real>

&nbsp;

GET /api/v1/sellers/<id real>

&nbsp;

Depois:

&nbsp;

- salvar Seller em usuário;

- reabrir usuário;

- confirmar profiles.erp_seller_id;

- trocar Seller;

- remover Seller.

&nbsp;

==================================================

39. CRITÉRIOS DE ACEITE

==================================================

&nbsp;

[ ] schema Firebird homologado preservado

[ ] IS_VENDEDOR = 1 preservado

[ ] empresas somente 1/3

[ ] nenhuma regra inventada de INATIVO/DELETED/DEMISSAO

[ ] GET /sellers retorna success.data.sellers

[ ] GET /sellers/:id retorna success.data.seller

[ ] callErp não alterado funcionalmente

[ ] Sellers isolado em erp-sellers.functions.ts

[ ] erp-orders.functions.ts restaurado ao estado pré-Sellers

[ ] erp-orders.functions.ts.temp removido

[ ] Novo Pedido não alterado

[ ] SELLER_NOT_FOUND somente para 404

[ ] ERP_UNAVAILABLE não mascarado

[ ] ERP_NETWORK_ERROR não mascarado

[ ] ERP_TIMEOUT não mascarado

[ ] erpSellerId inteiro positivo ou null

[ ] Seller validado antes do convite

[ ] Seller inválido não envia convite

[ ] ERP offline não envia convite

[ ] mismatch empresa não envia convite

[ ] update valida Seller antes da RPC

[ ] Seller pode ser alterado

[ ] Seller pode ser removido

[ ] Seller nullable

[ ] nenhuma limpeza silenciosa no UserDialog

[ ] profiles.erp_seller_id é única persistência

[ ] nenhuma tabela local Sellers

[ ] nenhuma migration criada

[ ] RPCs administrativas não alteradas

[ ] ZERO escrita Firebird

[ ] testes ERP passam

[ ] testes Server Fun