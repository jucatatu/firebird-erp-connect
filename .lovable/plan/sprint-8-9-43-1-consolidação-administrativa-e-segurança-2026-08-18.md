# SPRINT 8.9.43.1 — CONSOLIDAÇÃO ADMINISTRATIVA E SEGURANÇA

# PLANO COMPLETO FINAL PARA EXECUÇÃO

&nbsp;

OBJETIVO

&nbsp;

Concluir a Sprint 8.9.43.1 corrigindo as regressões encontradas e completando:

&nbsp;

- segurança de usuários inativos;

- proteção real do último administrador;

- sincronização Perfil Administrador ⇔ user_roles.admin;

- CRUD administrativo de usuários;

- CRUD de perfis de permissão;

- editor real da árvore de permissões;

- integração de vendedores ERP sem inventar schema.

&nbsp;

A implementação existente deve ser aproveitada.

&nbsp;

NÃO recriar o módulo.

NÃO editar migrations aplicadas.

NÃO iniciar Sprint 8.9.43.2.

NÃO recuperar o Mapa.

NÃO usar Fast Visual Edit.

&nbsp;

==================================================

1. MIGRATION CORRETIVA — has_permission

==================================================

&nbsp;

Criar NOVA migration.

&nbsp;

A versão final de:

&nbsp;

public.has_permission(

  _user_id UUID,

  _resource_key TEXT,

  _action TEXT

)

&nbsp;

deve exigir simultaneamente:

&nbsp;

1. profiles.active IS TRUE;

2. profiles.permission_profile_id não nulo;

3. permission_profiles.active IS TRUE;

4. permission_resources.active IS TRUE;

5. regra explícita em permission_profile_rules;

6. ação válida:

   view/create/edit/delete;

7. flag correspondente true.

&nbsp;

Qualquer falha:

&nbsp;

→ false.

&nbsp;

Preservar:

&nbsp;

- SECURITY DEFINER;

- STABLE;

- SET search_path = public;

- assinatura existente;

- grants existentes.

&nbsp;

Não perder nenhuma regra homologada no Sprint 8.9.43.

&nbsp;

==================================================

2. has_role

==================================================

&nbsp;

Preservar a proteção introduzida para usuário inativo.

&nbsp;

Usar:

&nbsp;

profiles.active IS TRUE

&nbsp;

Usuário inativo:

&nbsp;

has_role → false.

&nbsp;

Não alterar:

&nbsp;

app_role

user_roles

&nbsp;

Valores continuam:

&nbsp;

admin

vendedor

aprovador.

&nbsp;

==================================================

3. CONTA DESATIVADA

==================================================

&nbsp;

Preservar a implementação atual de `_authenticated.tsx`.

&nbsp;

Se:

&nbsp;

profile.active === false

&nbsp;

mostrar:

&nbsp;

`Conta desativada`

&nbsp;

`Seu acesso ao ERP Operacional está desativado. Entre em contato com um administrador.`

&nbsp;

Botão:

&nbsp;

`Sair`

&nbsp;

Não montar:

&nbsp;

- AppShell;

- Outlet;

- conteúdo da aplicação.

&nbsp;

Não redirecionar para outra rota autenticada.

&nbsp;

==================================================

4. PROTEÇÃO REAL DO ÚLTIMO ADMIN

==================================================

&nbsp;

Substituir a proteção atual baseada apenas em impedir auto-desativação.

&nbsp;

Regra real:

&nbsp;

NUNCA permitir que uma operação resulte em zero administradores ativos.

&nbsp;

Verificar server-side antes de:

&nbsp;

- desativar usuário;

- remover user_roles.admin;

- retirar Perfil Administrador;

- trocar Administrador por outro perfil.

&nbsp;

Administrador ativo deve ser considerado pela combinação coerente:

&nbsp;

profiles.active IS TRUE

+

Perfil Administrador

+

user_roles.admin

&nbsp;

Se após a alteração restariam zero:

&nbsp;

bloquear com:

&nbsp;

code:

LAST_ADMIN_PROTECTION

&nbsp;

Não bloquear a auto-desativação se houver outro administrador ativo.

&nbsp;

==================================================

5. SINCRONIZAÇÃO ADMINISTRADOR

==================================================

&nbsp;

Durante a transição:

&nbsp;

Perfil Administrador

⇔

user_roles.admin

&nbsp;

devem permanecer sincronizados.

&nbsp;

Ao atribuir Perfil Administrador:

garantir role admin.

&nbsp;

Ao adicionar role admin:

garantir Perfil Administrador.

&nbsp;

Ao retirar Perfil Administrador:

retirar role admin, se permitido.

&nbsp;

Ao retirar role admin:

retirar Perfil Administrador, se permitido.

&nbsp;

Sempre passar pela proteção LAST_ADMIN_PROTECTION.

&nbsp;

Não sincronizar automaticamente outros perfis com:

&nbsp;

vendedor

aprovador.

&nbsp;

==================================================

6. SERVER FUNCTIONS DE USUÁRIOS

==================================================

&nbsp;

Completar:

&nbsp;

- listAdminUsers;

- inviteUser;

- updateUser;

- setUserActiveStatus.

&nbsp;

Toda função deve:

&nbsp;

1. autenticar pela sessão;

2. obter userId executor do contexto confiável;

3. requirePermission;

4. validar com Zod;

5. executar server-side;

6. retornar erro padronizado.

&nbsp;

Permissões:

&nbsp;

listar:

admin.users/view

&nbsp;

convidar:

admin.users/create

&nbsp;

editar:

admin.users/edit

&nbsp;

reativar:

admin.users/edit

&nbsp;

desativar:

admin.users/delete

&nbsp;

IMPORTANTE:

&nbsp;

desativação NÃO deve usar apenas `edit`.

&nbsp;

==================================================

7. NOVO USUÁRIO

==================================================

&nbsp;

Implementar funcionalmente:

&nbsp;

`Novo usuário`

&nbsp;

Usar PermissionAction:

&nbsp;

admin.users/create.

&nbsp;

Campos:

&nbsp;

- nome completo;

- e-mail;

- Perfil de Permissão obrigatório;

- empresas;

- vendedor ERP opcional;

- roles legados.

&nbsp;

Empresas permitidas:

&nbsp;

1 = GRAAL

3 = GROTT

&nbsp;

Permitir:

&nbsp;

- Graal;

- Grott;

- ambas.

&nbsp;

Usar convite oficial do Supabase Auth.

&nbsp;

Não solicitar senha criada pelo administrador.

&nbsp;

Após o convite configurar:

&nbsp;

profiles.full_name

profiles.active = true

profiles.permission_profile_id

profiles.erp_seller_id

user_company_access

user_roles

&nbsp;

IMPORTANTE:

&nbsp;

Supabase Auth Admin + tabelas públicas não formam uma única transação PostgreSQL.

&nbsp;

Portanto implementar operação lógica segura com compensação.

&nbsp;

Se Auth for criado/convidado e a configuração seguinte falhar:

&nbsp;

- não deixar usuário com acesso operacional parcial;

- garantir profile.active=false ou outra medida segura;

- retornar erro claro;

- registrar etapa que falhou sem expor segredo.

&nbsp;

Não fingir atomicidade inexistente.

&nbsp;

==================================================

8. EDITAR USUÁRIO

==================================================

&nbsp;

Implementar funcionalmente:

&nbsp;

`Editar`

&nbsp;

E-mail:

read-only neste sprint.

&nbsp;

Permitir:

&nbsp;

- nome;

- Perfil de Permissão;

- empresas;

- vendedor ERP;

- roles legados;

- status.

&nbsp;

Usar:

&nbsp;

admin.users/edit

&nbsp;

para alterações normais.

&nbsp;

Se operação incluir:

&nbsp;

ativo → inativo

&nbsp;

exigir adicionalmente:

&nbsp;

admin.users/delete.

&nbsp;

Aplicar proteção do último admin.

&nbsp;

Após sucesso:

&nbsp;

invalidar/refazer queries administrativas e de permissão necessárias.

&nbsp;

==================================================

9. INTERFACE DE USUÁRIOS

==================================================

&nbsp;

A query com dados administrativos não deve montar antes da autorização:

&nbsp;

admin.users/view.

&nbsp;

Usar PermissionGate em nível que realmente impeça a query protegida de executar.

&nbsp;

Ações:

&nbsp;

Novo usuário

Editar

Desativar

&nbsp;

devem usar PermissionAction.

&nbsp;

Implementar filtros reais:

&nbsp;

- nome/e-mail;

- ativo/inativo;

- perfil;

- empresa;

- vendedor ERP vinculado/não vinculado.

&nbsp;

Exibir:

&nbsp;

- nome;

- e-mail;

- status;

- perfil;

- GRAAL/GROTT;

- vendedor ERP;

- roles legados.

&nbsp;

Badge quando necessário:

&nbsp;

VENDEDOR NÃO VINCULADO.

&nbsp;

==================================================

10. CRUD COMPLETO DE PERFIS

==================================================

&nbsp;

Completar:

&nbsp;

- listPermissionProfiles;

- createPermissionProfile;

- updatePermissionProfile;

- saveProfileRules;

- deletePermissionProfile.

&nbsp;

Permissões:

&nbsp;

view

create

edit

delete

&nbsp;

sobre:

&nbsp;

admin.permission_profiles.

&nbsp;

Perfil novo:

&nbsp;

name obrigatório

description opcional

active=true

is_system=false

todas as permissões começam false.

&nbsp;

Perfil customizado em uso:

&nbsp;

não excluir.

&nbsp;

Erro:

&nbsp;

PROFILE_IN_USE.

&nbsp;

==================================================

11. PERFIL ADMINISTRADOR

==================================================

&nbsp;

Administrador é perfil de sistema.

&nbsp;

NÃO permitir:

&nbsp;

- excluir;

- desativar;

- transformar em custom;

- retirar seu acesso completo.

&nbsp;

Continuar com:

&nbsp;

view=true

create=true

edit=true

delete=true

&nbsp;

em todos os recursos seedados.

&nbsp;

==================================================

12. EDITOR REAL DE PERMISSÕES

==================================================

&nbsp;

Implementar funcionalmente:

&nbsp;

`Gerenciar Regras`

&nbsp;

Carregar dados reais de:

&nbsp;

permission_resources

permission_profile_rules.

&nbsp;

Não hardcodar somente em JSX.

&nbsp;

Organizar por:

&nbsp;

parent_id

sort_order.

&nbsp;

Exibir:

&nbsp;

| Recurso | Visualizar | Criar | Editar | Deletar |

&nbsp;

Árvore esperada:

&nbsp;

Operação

- Mapa

- Entregas

- Recolhas

&nbsp;

Comercial

- Pedidos

- Aprovações

- Clientes ERP

&nbsp;

Administração

- Usuários

- Perfis de Permissão

- Integração ERP

- Catálogo

- Configurações

&nbsp;

Sem herança automática.

&nbsp;

Missing rule = false.

&nbsp;

Salvar regras explicitamente em lote.

&nbsp;

==================================================

13. SELLERS — REMOVER FALLBACK INVENTADO

==================================================

&nbsp;

Remover completamente o comportamento atual:

&nbsp;

VENDEDORES

→ se falhar FUNCIONARIOS

→ se falhar []

&nbsp;

Isso não é permitido.

&nbsp;

Até o schema real ser comprovado:

&nbsp;

GET /api/v1/sellers

&nbsp;

não deve executar SQL baseado em nomes presumidos.

&nbsp;

Retornar erro controlado:

&nbsp;

SELLER_SCHEMA_NOT_DISCOVERED

&nbsp;

ou equivalente.

&nbsp;

Não transformar erro estrutural em lista vazia.

&nbsp;

==================================================

14. SCRIPT DE INTROSPECÇÃO

==================================================

&nbsp;

Corrigir:

&nbsp;

erp-api/scripts/inspect-sellers-schema.js

&nbsp;

para usar o Firebird client real do projeto.

&nbsp;

O script deve investigar metadata real:

&nbsp;

- RDB$RELATION_FIELDS;

- tabelas contendo ID_VENDEDOR;

- relacionamentos;

- constraints;

- procedures;

- referências ao campo.

&nbsp;

Não assumir:

&nbsp;

VENDEDORES

FUNCIONARIOS

USUARIOS

&nbsp;

como fonte verdadeira.

&nbsp;

Não executar SELECT * indiscriminadamente.

&nbsp;

Após identificar uma relação provável:

&nbsp;

mostrar somente metadata e pequena amostra necessária para comprovação.

&nbsp;

ZERO escrita no Firebird.

&nbsp;

==================================================

15. ENDPOINT SELLERS

==================================================

&nbsp;

Somente implementar SQL definitivo depois de comprovar:

&nbsp;

- tabela real;

- coluna ID;

- coluna nome;

- relacionamento que prova que representa vendedor;

- coluna ativo, somente se existir.

&nbsp;

Depois disso:

&nbsp;

GET /api/v1/sellers?q=&limit=

&nbsp;

com:

&nbsp;

- HMAC;

- Zod;

- SQL parametrizado;

- limite seguro;

- zero escrita.

&nbsp;

Se Lovable não tiver acesso ao Firebird para executar a introspecção:

&nbsp;

NÃO inventar.

&nbsp;

Manter endpoint como:

&nbsp;

SELLER_SCHEMA_NOT_DISCOVERED

&nbsp;

e informar:

&nbsp;

SELLERS PENDENTE DE HOMOLOGAÇÃO FIREBIRD.

&nbsp;

==================================================

16. VENDEDOR ERP NA TELA DE USUÁRIO

==================================================

&nbsp;

IMPORTANTE:

&nbsp;

este campo pertence ao:

&nbsp;

CADASTRO/EDIÇÃO DE USUÁRIO.

&nbsp;

NÃO ao cadastro de Cliente.

&nbsp;

Quando sellers estiver homologado:

&nbsp;

campo Vendedor ERP

→ debounce

→ searchErpSellers

→ Server Function

→ HMAC

→ Node

→ resultados

&nbsp;

Mostrar:

&nbsp;

ID + Nome.

&nbsp;

Salvar apenas:

&nbsp;

profiles.erp_seller_id.

&nbsp;

Enquanto schema não estiver homologado:

&nbsp;

campo fica desabilitado.

&nbsp;

Mensagem:

&nbsp;

`Consulta de vendedores ERP aguardando homologação do schema.`

&nbsp;

Não mostrar vendedores fictícios.

&nbsp;

==================================================

17. TESTES

==================================================

&nbsp;

Adicionar testes para:

&nbsp;

BANCO/PERMISSÃO

&nbsp;

- usuário inativo → has_permission false;

- perfil inativo → false;

- recurso inativo → false;

- ação inválida → false;

- has_role usuário inativo → false.

&nbsp;

ADMIN

&nbsp;

- último admin bloqueado;

- dois admins permitem desativação de um;

- sincronização perfil Administrador/admin;

- create/invite user;

- update user;

- empresas;

- profile;

- active/inactive;

- proteção Perfil Administrador;

- PROFILE_IN_USE.

&nbsp;

UI

&nbsp;

- sem view não consulta dados protegidos;

- PermissionDenied;

- Novo usuário disabled sem create;

- Editar disabled sem edit;

- Desativar disabled sem delete.

&nbsp;

SELLERS

&nbsp;

Enquanto não homologado:

&nbsp;

- endpoint não consulta tabelas inventadas;

- retorna SELLER_SCHEMA_NOT_DISCOVERED;

- script é read-only.

&nbsp;

Depois de homologado:

&nbsp;

- busca;

- limite;

- validação;

- HMAC;

- SQL parametrizado.

&nbsp;

Preservar os 16 testes homologados do Sprint 8.9.43.

&nbsp;

==================================================

18. VALIDAÇÃO FINAL

==================================================

&nbsp;

Executar frontend:

&nbsp;

testes

typecheck

build

lint

&nbsp;

Executar Node:

&nbsp;

npm run check

npm test

&nbsp;

Informar resultados reais.

&nbsp;

==================================================

19. NÃO ALTERAR

==================================================

&nbsp;

Não alterar funcionalmente:

&nbsp;

- Novo Cliente;

- PF/PJ;

- Grupo Cliente;

- Google Places;

- Novo Pedido;

- itens;

- equipamentos;

- logística;

- pagamento;

- order_drafts;

- Entregas;

- Recolhas;

- Mapa;

- geocodificação.

&nbsp;

No Node:

&nbsp;

somente sellers/introspecção.

&nbsp;

ZERO escrita Firebird.

&nbsp;

==================================================

20. RELATÓRIO E PARADA

==================================================

&nbsp;

Ao finalizar informar:

&nbsp;

1. migration corretiva criada;

2. versão final de has_permission;

3. has_role;

4. proteção último admin;

5. sincronização Administrador/admin;

6. inviteUser;

7. updateUser;

8. comportamento activate/deactivate;

9. empresas por usuário;

10. CRUD de Perfis;

11. editor real da árvore;

12. status do Sellers;

13. se schema foi comprovado;

14. evidência do schema;

15. SQL Sellers, se existir;

16. testes frontend;

17. testes Node;

18. build/typecheck/lint;

19. confirmação ZERO escrita Firebird.

&nbsp;

Se schema do vendedor não estiver comprovado, declarar exatamente:

&nbsp;

SELLERS PENDENTE DE HOMOLOGAÇÃO FIREBIRD.

&nbsp;

PARAR.

&nbsp;

NÃO iniciar Sprint 8.9.43.2.

NÃO recuperar o Mapa.

&nbsp;

Aguardar publicação e revisão do Git.