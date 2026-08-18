# SPRINT 8.9.43.1 — ADMINISTRAÇÃO DE USUÁRIOS E PERFIS

# PLANO COMPLETO CONSOLIDADO

&nbsp;

OBJETIVO

&nbsp;

Implementar administração de:

&nbsp;

- usuários;

- perfis de permissão;

- matriz CRUD por recurso;

- empresas permitidas por usuário;

- roles legados durante a transição;

- vendedor ERP;

- ativação/desativação segura.

&nbsp;

Usar integralmente a fundação homologada no Sprint 8.9.43.

&nbsp;

NÃO recriar permissões.

NÃO remover user_roles/has_role.

NÃO iniciar 8.9.43.2.

NÃO recuperar o Mapa neste sprint.

NÃO usar Fast Visual Edit.

&nbsp;

==================================================

1. TELAS E ROTAS

==================================================

&nbsp;

Criar:

&nbsp;

/admin/users

→ recurso `admin.users`

&nbsp;

/admin/permission-profiles

→ recurso `admin.permission_profiles`

&nbsp;

No Sidebar:

&nbsp;

- habilitar "Usuários" já existente em `/admin/users`;

- adicionar "Perfis de Permissão";

- manter ambos `adminOnly` durante a transição.

&nbsp;

Não migrar o restante da Sidebar agora.

&nbsp;

Aplicar nas duas telas:

&nbsp;

PermissionGate para `view`.

&nbsp;

PermissionAction para:

- create;

- edit;

- delete.

&nbsp;

Sem `view`:

→ rota permanece acessível;

→ mostrar PermissionDenied;

→ não consultar dados administrativos protegidos.

&nbsp;

==================================================

2. SEGURANÇA SERVER-SIDE

==================================================

&nbsp;

Toda operação administrativa deve ocorrer por Server Function.

&nbsp;

Fluxo obrigatório:

&nbsp;

sessão autenticada

→ obter executor pela sessão

→ requirePermission(resource, action)

→ validar payload

→ executar operação

&nbsp;

NUNCA confiar em userId vindo do browser como identidade do administrador.

&nbsp;

Service Role somente server-side.

&nbsp;

Nunca:

&nbsp;

- VITE_SERVICE_ROLE;

- enviar segredo ao browser;

- logar token;

- commitá-lo.

&nbsp;

==================================================

3. MIGRATION DE SEGURANÇA

==================================================

&nbsp;

Criar NOVA migration.

&nbsp;

Não editar migrations aplicadas.

&nbsp;

Atualizar:

&nbsp;

public.has_permission

&nbsp;

e:

&nbsp;

public.has_role

&nbsp;

para também exigir:

&nbsp;

profiles.active = true.

&nbsp;

Usuário com:

&nbsp;

profiles.active = false

&nbsp;

deve receber:

&nbsp;

has_permission → false

has_role → false

&nbsp;

Preservar:

&nbsp;

- assinaturas atuais;

- SECURITY DEFINER;

- `SET search_path = public`;

- comportamento dos usuários ativos.

&nbsp;

Isso garante que RLS nova e RLS legada também bloqueiem usuários desativados.

&nbsp;

==================================================

4. USUÁRIO DESATIVADO

==================================================

&nbsp;

Em `_authenticated.tsx`:

&nbsp;

se:

&nbsp;

profile.active === false

&nbsp;

NÃO renderizar AppShell/Outlet da aplicação.

&nbsp;

NÃO redirecionar para Pedidos.

NÃO redirecionar para outra rota autenticada.

NÃO gerar loop de navegação.

&nbsp;

Mostrar estado dedicado:

&nbsp;

Título:

`Conta desativada`

&nbsp;

Texto:

`Seu acesso ao ERP Operacional está desativado. Entre em contato com um administrador.`

&nbsp;

Botão:

`Sair`

&nbsp;

O botão deve encerrar a sessão e retornar ao login.

&nbsp;

==================================================

5. LISTAGEM DE USUÁRIOS

==================================================

&nbsp;

`/admin/users`

&nbsp;

Desktop:

tabela.

&nbsp;

Mobile:

cards.

&nbsp;

Exibir:

&nbsp;

- nome;

- e-mail;

- ativo/inativo;

- Perfil de Permissão;

- empresas;

- vendedor ERP;

- roles legados.

&nbsp;

Badges:

&nbsp;

ATIVO / INATIVO

GRAAL

GROTT

SEM PERFIL

VENDEDOR NÃO VINCULADO

&nbsp;

Filtros:

&nbsp;

- nome/e-mail;

- status;

- perfil;

- empresa;

- vendedor vinculado/não vinculado.

&nbsp;

Não exibir senha, token ou metadata sensível do Auth.

&nbsp;

==================================================

6. NOVO USUÁRIO

==================================================

&nbsp;

Botão:

&nbsp;

`Novo usuário`

&nbsp;

Permissão:

&nbsp;

admin.users / create

&nbsp;

Campos:

&nbsp;

- nome completo;

- e-mail;

- Perfil de Permissão obrigatório;

- empresas permitidas;

- vendedor ERP opcional;

- roles legados temporários.

&nbsp;

Empresas válidas:

&nbsp;

1 = GRAAL

3 = GROTT

&nbsp;

Permitir:

&nbsp;

- apenas Graal;

- apenas Grott;

- ambas.

&nbsp;

Não solicitar senha administrativa/manual.

&nbsp;

Usar preferencialmente convite oficial do Supabase Auth.

&nbsp;

Se convite Auth não estiver configurado:

&nbsp;

NÃO inventar senha;

NÃO criar solução insegura;

informar o bloqueio.

&nbsp;

Após criação configurar:

&nbsp;

profiles.full_name

profiles.active = true

profiles.permission_profile_id

profiles.erp_seller_id

&nbsp;

e:

&nbsp;

user_company_access

user_roles

&nbsp;

Se Auth for criado mas a configuração administrativa falhar:

&nbsp;

não deixar usuário com acesso parcial/inseguro.

&nbsp;

Desativar o acesso e retornar erro administrável.

&nbsp;

==================================================

7. EDITAR USUÁRIO

==================================================

&nbsp;

Permissão:

&nbsp;

admin.users / edit

&nbsp;

E-mail:

read-only neste sprint.

&nbsp;

Permitir editar:

&nbsp;

- nome;

- perfil;

- empresas;

- vendedor ERP;

- roles legados;

- ativo/inativo.

&nbsp;

Salvar como uma única operação administrativa lógica.

&nbsp;

Após alteração de permission_profile_id:

&nbsp;

invalidar/refazer caches de permissão relacionados.

&nbsp;

==================================================

8. COMPATIBILIDADE COM user_roles

==================================================

&nbsp;

Preservar:

&nbsp;

admin

vendedor

aprovador

&nbsp;

Não adicionar novos valores ao enum app_role.

&nbsp;

A interface deve exibir seção:

&nbsp;

`Compatibilidade do sistema atual`

&nbsp;

com:

&nbsp;

[ ] Administrador

[ ] Vendedor

[ ] Aprovador

&nbsp;

Regra obrigatória:

&nbsp;

Perfil Administrador

⇔

legacy role admin

&nbsp;

Ou seja:

&nbsp;

se atribuir perfil Administrador:

garantir `admin` em user_roles.

&nbsp;

se adicionar legacy `admin`:

garantir perfil Administrador.

&nbsp;

Se retirar um dos dois:

retirar o outro, salvo proteção do último administrador.

&nbsp;

Essa sincronização deve ser server-side e consistente.

&nbsp;

Não mapear automaticamente outros perfis para vendedor/aprovador.

&nbsp;

==================================================

9. PROTEÇÃO DO ÚLTIMO ADMIN

==================================================

&nbsp;

Implementar no servidor.

&nbsp;

Nunca permitir que o sistema fique sem administrador ativo.

&nbsp;

Bloquear:

&nbsp;

- desativar o último admin ativo;

- remover legacy role admin do último admin ativo;

- retirar o Perfil Administrador do último admin ativo.

&nbsp;

Erro:

&nbsp;

code:

`LAST_ADMIN_PROTECTION`

&nbsp;

A proteção deve considerar conjuntamente:

&nbsp;

profiles.active

permission_profile Administrador

user_roles admin

&nbsp;

Não depender somente de botão disabled.

&nbsp;

==================================================

10. PERFIS DE PERMISSÃO

==================================================

&nbsp;

Criar:

&nbsp;

`/admin/permission-profiles`

&nbsp;

Permissões:

&nbsp;

view   → visualizar

create → novo perfil

edit   → editar perfil/regras

delete → excluir perfil

&nbsp;

Mostrar:

&nbsp;

- nome;

- descrição;

- ativo;

- sistema/custom;

- quantidade de usuários vinculados.

&nbsp;

Novo perfil:

&nbsp;

- name obrigatório;

- description opcional;

- active = true;

- is_system = false;

- todas as permissões inicialmente false.

&nbsp;

Usar as constraints de unicidade já existentes.

&nbsp;

==================================================

11. ÁRVORE DE PERMISSÕES

==================================================

&nbsp;

Montar a interface usando DADOS REAIS de:

&nbsp;

permission_resources

permission_profile_rules

&nbsp;

Não hardcodar a árvore apenas em JSX.

&nbsp;

Exibir:

&nbsp;

Operação

  Mapa

  Entregas

  Recolhas

&nbsp;

Comercial

  Pedidos

  Aprovações

  Clientes ERP

&nbsp;

Administração

  Usuários

  Perfis de Permissão

  Integração ERP

  Catálogo

  Configurações

&nbsp;

Matriz:

&nbsp;

| Recurso | Visualizar | Criar | Editar | Deletar |

&nbsp;

Ordenar pela estrutura:

&nbsp;

parent_id

sort_order

&nbsp;

A árvore é somente organizacional.

&nbsp;

NÃO implementar herança automática.

&nbsp;

Exemplo:

&nbsp;

operation.view = true

&nbsp;

NÃO significa:

&nbsp;

operation.deliveries.view = true

&nbsp;

Missing rule = false.

&nbsp;

Salvar alterações em lote.

&nbsp;

Botão opcional:

`Marcar todos`

&nbsp;

deve escrever explicitamente cada regra.

&nbsp;

==================================================

12. PERFIL ADMINISTRADOR

==================================================

&nbsp;

Administrador:

&nbsp;

is_system = true

&nbsp;

NÃO permitir:

&nbsp;

- excluir;

- desativar;

- remover CRUD completo;

- transformar em custom.

&nbsp;

Administrador deve continuar com:

&nbsp;

view/create/edit/delete = true

&nbsp;

em todos os recursos.

&nbsp;

Perfil customizado em uso:

&nbsp;

NÃO excluir.

&nbsp;

Erro:

&nbsp;

`PROFILE_IN_USE`

&nbsp;

Mensagem:

&nbsp;

`Este perfil está vinculado a usuários. Reatribua os usuários antes de excluí-lo.`

&nbsp;

Não usar ON DELETE SET NULL como comportamento administrativo normal.

&nbsp;

==================================================

13. VENDEDORES ERP — DESCOBERTA PRIMEIRO

==================================================

&nbsp;

Fonte da verdade:

&nbsp;

Firebird.

&nbsp;

Persistência local:

&nbsp;

somente `profiles.erp_seller_id`.

&nbsp;

NÃO criar tabela de vendedores no Supabase.

&nbsp;

ANTES de implementar endpoint:

&nbsp;

descobrir o schema real relacionado a `ID_VENDEDOR`.

&nbsp;

Pesquisar:

&nbsp;

- SQL existente;

- stored procedures;

- documentação de introspecção;

- metadata Firebird;

- relacionamentos que usam ID_VENDEDOR.

&nbsp;

IMPORTANTE:

&nbsp;

NÃO assumir nomes de tabelas como:

&nbsp;

VENDEDORES

FUNCIONARIOS

USUARIOS

&nbsp;

ou qualquer outro.

&nbsp;

Esses nomes podem ser investigados, mas NÃO usados como verdade sem comprovação.

&nbsp;

Se o ambiente Lovable não conseguir comprovar o schema:

&nbsp;

criar script READ-ONLY, por exemplo:

&nbsp;

`erp-api/scripts/inspect-sellers-schema.js`

&nbsp;

para rodar no servidor conectado ao Firebird.

&nbsp;

O script deve:

&nbsp;

- consultar metadata;

- localizar relacionamentos/campos compatíveis com ID_VENDEDOR;

- retornar nomes reais;

- opcionalmente mostrar poucas linhas sanitizadas;

- fazer ZERO escrita.

&nbsp;

Se ainda não houver evidência suficiente:

&nbsp;

PARAR a parte de sellers e relatar.

&nbsp;

NÃO inventar SQL.

&nbsp;

==================================================

14. ENDPOINT SELLERS

==================================================

&nbsp;

SOMENTE depois de comprovar o schema:

&nbsp;

criar:

&nbsp;

GET /api/v1/sellers

&nbsp;

Query:

&nbsp;

q

limit

&nbsp;

Requisitos:

&nbsp;

- somente leitura;

- HMAC atual;

- validação;

- SQL parametrizado;

- limite máximo seguro;

- nenhuma alteração de dados.

&nbsp;

Contrato conceitual:

&nbsp;

{

  "success": true,

  "sellers": [

    {

      "id": 123,

      "name": "Nome real do ERP",

      "active": true | false | null

    }

  ]

}

&nbsp;

`active` somente se existir informação real comprovada.

&nbsp;

Não inventar coluna de ativo.

&nbsp;

Adicionar testes:

&nbsp;

- busca;

- lista vazia;

- limit;

- validação;

- HMAC;

- SQL parametrizado;

- nenhuma escrita.

&nbsp;

==================================================

15. VENDEDOR ERP NO FRONTEND

==================================================

&nbsp;

Criar Server Function:

&nbsp;

searchErpSellers

&nbsp;

Browser NÃO chama Node diretamente.

&nbsp;

Fluxo:

&nbsp;

campo Vendedor ERP

→ debounce

→ Server Function

→ HMAC

→ GET /api/v1/sellers

→ resultados

&nbsp;

Exibir:

&nbsp;

ID ERP + Nome.

&nbsp;

Ao selecionar:

&nbsp;

salvar SOMENTE:

&nbsp;

profiles.erp_seller_id

&nbsp;

Não armazenar nome como cópia oficial.

&nbsp;

Permitir:

&nbsp;

`Sem vendedor vinculado`

&nbsp;

Quando usuário depende de criação de pedidos e não possui seller:

&nbsp;

mostrar aviso:

&nbsp;

`Vendedor ERP não vinculado.`

&nbsp;

Não alterar a lógica atual do Novo Pedido.

&nbsp;

==================================================

16. SERVER FUNCTIONS

==================================================

&nbsp;

Criar funções equivalentes a:

&nbsp;

Usuários:

- listUsers

- inviteUser

- updateUser

- setUserActive

&nbsp;

Perfis:

- listPermissionProfiles

- createPermissionProfile

- updatePermissionProfile

- savePermissionRules

- deletePermissionProfile

&nbsp;

ERP:

- searchErpSellers

&nbsp;

Toda função administrativa deve:

&nbsp;

1. autenticar;

2. obter executor da sessão;

3. requirePermission;

4. validar payload;

5. executar;

6. devolver erro padronizado.

&nbsp;

Erros previstos:

&nbsp;

PERMISSION_DENIED

VALIDATION_ERROR

LAST_ADMIN_PROTECTION

PROFILE_IN_USE

USER_INVITE_FAILED

ERP_UNAVAILABLE

SELLER_NOT_FOUND

PERMISSION_CHECK_FAILED

&nbsp;

Não vazar:

&nbsp;

SQL

stack

service role

segredos HMAC

&nbsp;

==================================================

17. TESTES E HOMOLOGAÇÃO

==================================================

&nbsp;

Testar:

&nbsp;

USUÁRIOS

- listar;

- convidar;

- editar;

- empresas 1/3;

- perfil;

- seller;

- roles legados;

- desativar;

- reativar;

- último admin;

- inativo perde has_permission;

- inativo perde has_role.

&nbsp;

PERFIS

- criar;

- editar;

- matriz CRUD;

- sem herança;

- Administrador protegido;

- perfil em uso não exclui.

&nbsp;

UI

- sem view → PermissionDenied;

- create/edit/delete sem permissão → ações disabled.

&nbsp;

SELLERS

- schema comprovado;

- endpoint read-only;

- busca;

- validação;

- HMAC;

- zero escrita.

&nbsp;

Executar frontend:

&nbsp;

- testes;

- typecheck;

- build;

- lint.

&nbsp;

Executar erp-api:

&nbsp;

npm run check

npm test

&nbsp;

Os 16 testes homologados do Sprint 8.9.43 devem continuar passando.

&nbsp;

==================================================

18. NÃO ALTERAR E REGRA DE PARADA

==================================================

&nbsp;

NÃO alterar funcionalmente:

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

- edição;

- order_drafts;

- Entregas;

- Recolhas;

- Mapa;

- geocodificação.

&nbsp;

No Node:

&nbsp;

alterar SOMENTE sellers/introspecção quando comprovado.

&nbsp;

ZERO escrita no Firebird.

&nbsp;

Ao finalizar entregar:

&nbsp;

1. migration criada;

2. has_permission alterado;

3. has_role alterado;

4. comportamento de usuário inativo;

5. arquivos de Usuários;

6. arquivos de Perfis;

7. Server Functions;

8. proteção do último admin;

9. sincronização Administrador ⇔ admin;

10. empresas por usuário;

11. endpoint sellers;

12. schema Firebird real descoberto;

13. evidência usada para comprovar o schema;

14. arquivos Node alterados;

15. testes frontend;

16. testes Node;

17. resultados de build/typecheck/lint;

18. confirmação de ZERO escrita Firebird.

&nbsp;

Se o schema de vendedores NÃO puder ser comprovado:

&nbsp;

informar isso claramente e entregar o restante do sprint sem inventar implementação.

&nbsp;

PARAR.

&nbsp;

NÃO iniciar Sprint 8.9.43.2.

NÃO recuperar o Mapa.

&nbsp;

Aguardar publicação e revisão do Git.