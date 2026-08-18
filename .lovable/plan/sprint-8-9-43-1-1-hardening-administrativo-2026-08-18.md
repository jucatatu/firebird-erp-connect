# SPRINT 8.9.43.1.1 — HARDENING ADMINISTRATIVO

# PLANO COMPLETO CONSOLIDADO PARA EXECUÇÃO

&nbsp;

OBJETIVO

&nbsp;

Concluir exclusivamente o hardening administrativo identificado na revisão do Git.

&nbsp;

Corrigir:

&nbsp;

1. concorrência da LAST_ADMIN_PROTECTION;

2. proteção server-side do Perfil Administrador;

3. allowlist server-side de empresas 1 e 3;

4. imutabilidade real do erpSellerId enquanto Sellers estiver pendente;

5. execução das queries administrativas somente após PermissionGate;

6. cobertura de testes dessas regras.

&nbsp;

PRESERVAR todo o restante já implementado.

&nbsp;

NÃO recriar administração.

NÃO alterar Sellers/Firebird.

NÃO alterar Novo Cliente.

NÃO alterar Novo Pedido.

NÃO alterar Entregas.

NÃO alterar Recolhas.

NÃO alterar Mapa.

NÃO iniciar Sprint 8.9.43.2.

NÃO usar Fast Visual Edit.

&nbsp;

==================================================

1. PRESERVAR ESTADO ATUAL

==================================================

&nbsp;

Preservar:

&nbsp;

- has_permission;

- has_role;

- Conta desativada;

- /admin/users;

- /admin/permission-profiles;

- UserDialog;

- ProfileDialog;

- RulesEditorDialog;

- inviteUser;

- updateUser;

- admin_update_user;

- admin_setup_invited_user;

- CRUD de Perfis;

- editor da matriz CRUD;

- PermissionGate;

- PermissionAction;

- user_roles;

- user_company_access.

&nbsp;

Sellers deve continuar exatamente:

&nbsp;

SELLERS PENDENTE DE HOMOLOGAÇÃO FIREBIRD.

&nbsp;

Preservar:

&nbsp;

SELLER_SCHEMA_NOT_DISCOVERED.

&nbsp;

==================================================

2. NOVA MIGRATION

==================================================

&nbsp;

Criar NOVA migration.

&nbsp;

NÃO editar migrations aplicadas.

&nbsp;

Refatorar a proteção administrativa existente.

&nbsp;

==================================================

3. LOCK TRANSACIONAL

==================================================

&nbsp;

Na RPC:

&nbsp;

public.admin_update_user

&nbsp;

adquirir ANTES de calcular o estado administrativo:

&nbsp;

SELECT pg_advisory_xact_lock(7142026);

&nbsp;

A chave deve ser documentada como lock exclusivo das mutações administrativas que possam alterar o conjunto de administradores.

&nbsp;

O lock:

&nbsp;

- vale somente pela transação;

- libera automaticamente em commit/rollback;

- deve ser adquirido antes da contagem/decisão;

- não pode depender de contagem feita previamente.

&nbsp;

Depois do lock:

&nbsp;

1. reler o usuário alvo;

2. determinar se é admin ativo;

3. resolver o novo perfil;

4. normalizar Perfil Administrador ⇔ role admin;

5. calcular o estado resultante;

6. validar LAST_ADMIN_PROTECTION;

7. somente então persistir.

&nbsp;

Se `admin_setup_invited_user` usar o mesmo lock para consistência administrativa, tudo bem, mas documentar que ele NÃO é necessário para evitar remoção do último admin porque essa RPC adiciona/configura usuário.

&nbsp;

Não criar lock desnecessário em operações somente leitura.

&nbsp;

==================================================

4. LAST_ADMIN_PROTECTION FINAL

==================================================

&nbsp;

Administrador ativo:

&nbsp;

profiles.active IS TRUE

AND

permission_profiles.is_system IS TRUE

AND

permission_profiles.name = 'Administrador'

AND

user_roles.role = 'admin'.

&nbsp;

Nunca permitir que admin_update_user deixe zero administradores ativos.

&nbsp;

Erro identificável:

&nbsp;

LAST_ADMIN_PROTECTION.

&nbsp;

Cenários:

&nbsp;

1 admin

→ remover/desativar/trocar perfil = BLOQUEADO.

&nbsp;

2 admins

→ remover um = PERMITIDO.

&nbsp;

Após isso sobra 1

→ remover o restante = BLOQUEADO.

&nbsp;

Concorrência:

duas transações não podem remover os dois simultaneamente.

&nbsp;

==================================================

5. ALLOWLIST DE EMPRESAS — ZOD

==================================================

&nbsp;

Em:

&nbsp;

inviteUser

updateUser

&nbsp;

aceitar somente:

&nbsp;

1

3

&nbsp;

Validação conceitual:

&nbsp;

z.array(z.union([z.literal(1), z.literal(3)]))

 .min(1)

&nbsp;

Aceitar:

&nbsp;

[1]

[3]

[1,3]

&nbsp;

Rejeitar:

&nbsp;

[]

[2]

[4]

[99]

[1,2]

[3,99]

&nbsp;

Se necessário, impedir duplicados.

&nbsp;

==================================================

6. ALLOWLIST DE EMPRESAS — RPC

==================================================

&nbsp;

Também validar dentro de:

&nbsp;

admin_update_user

admin_setup_invited_user

&nbsp;

antes de qualquer DELETE/INSERT.

&nbsp;

Se `_company_ids`:

&nbsp;

- estiver vazio;

- contiver valor diferente de 1 ou 3;

&nbsp;

RAISE EXCEPTION identificável como:

&nbsp;

INVALID_COMPANY_ACCESS.

&nbsp;

Não confiar somente no frontend/Zod.

&nbsp;

Nenhuma mutação deve ocorrer antes dessa validação.

&nbsp;

==================================================

7. SELLER — IMUTABILIDADE REAL

==================================================

&nbsp;

Enquanto:

&nbsp;

SELLER_SCHEMA_NOT_DISCOVERED

&nbsp;

estiver vigente:

&nbsp;

NOVO USUÁRIO:

erp_seller_id deve ser obrigatoriamente NULL.

&nbsp;

EDIÇÃO:

erp_seller_id existente deve ser preservado.

&nbsp;

IMPORTANTE:

&nbsp;

NÃO confiar no valor de `erpSellerId` enviado pelo browser.

&nbsp;

Em inviteUser:

&nbsp;

ignorar/rejeitar qualquer erpSellerId diferente de null.

&nbsp;

Em updateUser:

&nbsp;

buscar server-side o erp_seller_id atual e preservar esse valor.

&nbsp;

Ou implementar proteção equivalente dentro da RPC.

&nbsp;

Payload manipulado NÃO pode trocar seller.

&nbsp;

A UI continua mostrando:

&nbsp;

`Consulta de vendedores ERP aguardando homologação do schema.`

&nbsp;

Campo continua disabled.

&nbsp;

NÃO modificar módulo Node Sellers.

&nbsp;

==================================================

8. PERFIL ADMINISTRADOR — SERVER-SIDE

==================================================

&nbsp;

Em:

&nbsp;

updatePermissionProfile

&nbsp;

se o perfil atual possui:

&nbsp;

is_system = true

&nbsp;

permitir alterar SOMENTE:

&nbsp;

description.

&nbsp;

NÃO permitir alterar:

&nbsp;

name

active

is_system.

&nbsp;

Para o Perfil Administrador:

&nbsp;

name = 'Administrador'

active = true

is_system = true

&nbsp;

devem permanecer invariáveis.

&nbsp;

Se payload tentar modificar campo protegido:

&nbsp;

erro:

&nbsp;

SYSTEM_PROFILE_PROTECTED.

&nbsp;

A proteção deve existir no servidor independentemente da UI.

&nbsp;

==================================================

9. REGRAS DO ADMINISTRADOR

==================================================

&nbsp;

Preservar e confirmar a proteção server-side de:

&nbsp;

saveProfileRules.

&nbsp;

Perfil Administrador não pode ter nenhuma regra alterada para false.

&nbsp;

Não confiar somente no:

&nbsp;

RulesEditorDialog read-only.

&nbsp;

Chamada manipulada deve ser rejeitada.

&nbsp;

Erro claro:

&nbsp;

SYSTEM_PROFILE_PROTECTED

&nbsp;

ou equivalente já padronizado.

&nbsp;

==================================================

10. PERMISSIONGATE — USERS

==================================================

&nbsp;

Hoje a query de usuários é iniciada no componente antes do PermissionGate.

&nbsp;

Corrigir.

&nbsp;

Estrutura:

&nbsp;

AdminUsersPage

  → PermissionGate admin.users/view

      → AdminUsersContent

          → useSuspenseQuery/listAdminUsers

          → cabeçalho e ações

          → tabela/dialogs

&nbsp;

Sem view:

&nbsp;

- PermissionDenied;

- AdminUsersContent não monta;

- listAdminUsers NÃO é executada;

- UserDialog NÃO é montado.

&nbsp;

Ação "Novo usuário" deve ficar dentro da área protegida por view e continuar utilizando:

&nbsp;

PermissionAction admin.users/create.

&nbsp;

==================================================

11. PERMISSIONGATE — PROFILES

==================================================

&nbsp;

Estrutura equivalente:

&nbsp;

AdminProfilesPage

  → PermissionGate admin.permission_profiles/view

      → AdminProfilesContent

          → useSuspenseQuery/listPermissionProfiles

          → CRUD

          → dialogs

&nbsp;

Sem view:

&nbsp;

- PermissionDenied;

- listPermissionProfiles NÃO executa;

- dialogs administrativos NÃO montam.

&nbsp;

Preservar PermissionAction para:

&nbsp;

create

edit

delete.

&nbsp;

==================================================

12. PERMISSIONACTION

==================================================

&nbsp;

Preservar regra global:

&nbsp;

sem create/edit/delete:

&nbsp;

- ação permanece visível;

- disabled=true;

- aria-disabled=true;

- click não executa.

&nbsp;

Não esconder ação como substituto da autorização.

&nbsp;

==================================================

13. TESTES — LAST_ADMIN_PROTECTION

==================================================

&nbsp;

Adicionar testes para:

&nbsp;

- único admin → remoção bloqueada;

- dois admins → remover um permitido;

- restante → remoção bloqueada;

- erro LAST_ADMIN_PROTECTION identificável.

&nbsp;

Adicionar teste de concorrência real se infraestrutura permitir.

&nbsp;

Se não for possível testar concorrência real:

&nbsp;

entregar procedimento de homologação SQL com duas sessões simultâneas.

&nbsp;

Declarar explicitamente:

&nbsp;

CONCORRÊNCIA NÃO TESTADA AUTOMATICAMENTE

&nbsp;

caso seja apenas validação estrutural.

&nbsp;

==================================================

14. TESTES — EMPRESAS

==================================================

&nbsp;

Testar Server Function:

&nbsp;

[1] → válido

[3] → válido

[1,3] → válido

[2] → inválido

[99] → inválido

[1,2] → inválido

[] → inválido

&nbsp;

Quando houver infraestrutura para RPC:

&nbsp;

testar também diretamente que:

&nbsp;

INVALID_COMPANY_ACCESS

&nbsp;

ocorre no banco.

&nbsp;

==================================================

15. TESTES — PERFIL DE SISTEMA

==================================================

&nbsp;

Testar:

&nbsp;

Administrador rename

→ SYSTEM_PROFILE_PROTECTED.

&nbsp;

Administrador active=false

→ SYSTEM_PROFILE_PROTECTED.

&nbsp;

Administrador alteração de regras

→ bloqueada.

&nbsp;

Administrador description

→ permitida, se esse comportamento continuar previsto.

&nbsp;

Perfil customizado:

→ continua editável normalmente.

&nbsp;

==================================================

16. TESTES — SELLER

==================================================

&nbsp;

Enquanto pendente:

&nbsp;

inviteUser com seller não-null

→ rejeitar/ignorar de forma segura e persistir null.

&nbsp;

updateUser com seller diferente do existente

→ não alterar erp_seller_id.

&nbsp;

Confirmar:

&nbsp;

nenhuma chamada ao ERP Sellers é necessária para essas operações.

&nbsp;

==================================================

17. TESTES — PERMISSIONGATE

==================================================

&nbsp;

Admin Users sem view:

&nbsp;

- AdminUsersContent não monta;

- listAdminUsers não é chamada.

&nbsp;

Admin Users com view:

&nbsp;

- query executa.

&nbsp;

Admin Profiles sem view:

&nbsp;

- AdminProfilesContent não monta;

- listPermissionProfiles não é chamada.

&nbsp;

Admin Profiles com view:

&nbsp;

- query executa.

&nbsp;

==================================================

18. TESTES EXISTENTES

==================================================

&nbsp;

Preservar todos os testes anteriores, incluindo os 16 testes homologados do núcleo de permissões.

&nbsp;

Adicionar preferencialmente:

&nbsp;

src/lib/permissions/__tests__/admin-hardening.test.ts

&nbsp;

e testes de UI específicos caso seja mais adequado separar responsabilidades.

&nbsp;

Não concentrar teste React e RPC artificialmente em um único arquivo se isso prejudicar clareza.

&nbsp;

==================================================

19. VALIDAÇÃO

==================================================

&nbsp;

Executar:

&nbsp;

frontend:

&nbsp;

- test;

- typecheck;

- build;

- lint.

&nbsp;

Banco:

&nbsp;

- validar migration;

- validar RPCs;

- validar grants.

&nbsp;

Confirmar que:

&nbsp;

admin_update_user

admin_setup_invited_user

&nbsp;

continuam restritas ao contexto administrativo/service_role conforme arquitetura atual.

&nbsp;

==================================================

20. CRITÉRIOS DE ACEITE

==================================================

&nbsp;

[ ] nova migration criada

[ ] migrations anteriores não editadas

[ ] admin_update_user possui advisory xact lock

[ ] contagem/decisão ocorre depois do lock

[ ] concorrência não pode deixar zero admins

[ ] LAST_ADMIN_PROTECTION preservada

[ ] empresas somente 1/3 no Zod

[ ] empresas somente 1/3 na RPC

[ ] Administrador não renomeia server-side

[ ] Administrador não desativa server-side

[ ] regras Administrador protegidas server-side

[ ] seller novo = null

[ ] seller existente não pode ser alterado

[ ] users query só executa depois de view

[ ] profiles query só executa depois de view

[ ] dialogs não montam sem view

[ ] PermissionAction preservado

[ ] testes novos adicionados

[ ] testes antigos continuam passando

[ ] typecheck passa

[ ] build passa

[ ] lint verificado

[ ] Sellers não alterado

[ ] Firebird não alterado

&nbsp;

==================================================

21. RELATÓRIO FINAL

==================================================

&nbsp;

Informar:

&nbsp;

1. migration criada;

2. arquivos alterados;

3. localização do pg_advisory_xact_lock;

4. ordem da validação após aquisição do lock;

5. tratamento de LAST_ADMIN_PROTECTION;

6. validação Zod de empresas;

7. validação RPC de empresas;

8. proteção server-side do Administrador;

9. proteção de regras;

10. comportamento final do erpSellerId;

11. nova estrutura AdminUsersPage/AdminUsersContent;

12. nova estrutura AdminProfilesPage/AdminProfilesContent;

13. arquivos de teste;

14. quantidade passed;

15. failed;

16. skipped;

17. typecheck;

18. build;

19. lint;

20. se teste real de concorrência foi executado.

&nbsp;

Confirmar explicitamente:

&nbsp;

SELLERS PENDENTE DE HOMOLOGAÇÃO FIREBIRD.

&nbsp;

Confirmar:

&nbsp;

- módulo Sellers NÃO alterado;

- ZERO escrita Firebird;

- Novo Cliente NÃO alterado;

- Novo Pedido NÃO alterado;

- Entregas NÃO alteradas;

- Recolhas NÃO alteradas;

- Mapa NÃO alterado.

&nbsp;

==================================================

22. REGRA DE PARADA

==================================================

&nbsp;

Depois de concluir:

&nbsp;

PARAR.

&nbsp;

NÃO homologar Sellers automaticamente.

NÃO iniciar recuperação do Mapa.

NÃO iniciar Sprint 8.9.43.2.

&nbsp;

Aguardar publicação e revisão do Git.