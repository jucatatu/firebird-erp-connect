# # SPRINT 8.9.43 — NÚCLEO DE PERMISSÕES POR ÁRVORE

# PLANO COMPLETO DE IMPLEMENTAÇÃO

&nbsp;

OBJETIVO

&nbsp;

Implementar a fundação real do novo sistema de autorização do ERP Operacional usando:

&nbsp;

- perfis de permissão;

- árvore hierárquica de recursos/telas;

- quatro ações por recurso:

  - visualizar;

  - criar;

  - editar;

  - deletar;

- um perfil de permissão vinculado a cada usuário;

- helpers reutilizáveis no frontend;

- validação reutilizável no servidor;

- RLS e função SQL no Supabase;

- compatibilidade temporária com o sistema atual baseado em `user_roles`.

&nbsp;

IMPORTANTE:

&nbsp;

ESTE SPRINT DEVE SER IMPLEMENTADO NO CÓDIGO.

&nbsp;

NÃO apenas gerar ou atualizar `.lovable/plan.md`.

NÃO colocar este texto em uma página.

NÃO usar Fast Visual Edit para executar este sprint.

NÃO avançar automaticamente para Sprint 8.9.43.1.

&nbsp;

Ao concluir, deve existir código real, migrations, componentes, helpers e testes.

&nbsp;

==================================================

0. CORRIGIR PRIMEIRO A REGRESSÃO DE ROTA

==================================================

&nbsp;

As tentativas anteriores de aplicar este sprint alteraram indevidamente a estrutura da página inicial.

&nbsp;

Foi identificado que:

&nbsp;

- `src/routes/_authenticated.index.tsx` existia no estado estável anterior;

- esse arquivo foi removido;

- `src/routes/index.tsx` foi criado/substituído por uma página genérica:

  "Firebird ERP Connect";

- `src/routeTree.gen.ts` foi alterado em consequência disso.

&nbsp;

Essa alteração NÃO fazia parte do Sprint 8.9.43.

&nbsp;

Antes de implementar permissões:

&nbsp;

1. Restaurar a estrutura de rota autenticada existente antes das tentativas do Sprint 8.9.43.

&nbsp;

2. Restaurar o comportamento funcional de:

&nbsp;

   `src/routes/_authenticated.index.tsx`

&nbsp;

   preservando o fluxo autenticado existente.

&nbsp;

3. Remover a página genérica criada indevidamente em:

&nbsp;

   `src/routes/index.tsx`

&nbsp;

   caso ela não existisse no estado funcional anterior.

&nbsp;

4. Atualizar/regenerar `src/routeTree.gen.ts` pelo mecanismo normal do TanStack Router.

&nbsp;

5. NÃO editar manualmente `routeTree.gen.ts` como fonte de verdade.

&nbsp;

6. NÃO executar reset geral do repositório.

&nbsp;

7. NÃO reverter mudanças posteriores legítimas do projeto.

&nbsp;

8. NÃO afetar:

   - Novo Cliente;

   - Novo Pedido;

   - Entrega;

   - hotfixes de grupos;

   - Google Maps;

   - fluxo ERP;

   - equipamentos;

   - paginação;

   - APP-XXXX.

&nbsp;

A correção deve atingir SOMENTE a regressão de rota causada pelas últimas tentativas do Sprint 8.9.43.

&nbsp;

==================================================

1. REGRA FUNCIONAL DEFINITIVA

==================================================

&nbsp;

O modelo será:

&nbsp;

USUÁRIO

   ↓

PERFIL DE PERMISSÃO

   ↓

ÁRVORE DE RECURSOS

   ↓

VISUALIZAR / CRIAR / EDITAR / DELETAR

&nbsp;

Cada usuário terá UM perfil de permissão.

&nbsp;

Exemplos futuros:

&nbsp;

- Administrador

- Vendedor

- Entregador

- Financeiro

- Comercial

- Consulta

&nbsp;

Neste sprint:

&nbsp;

NÃO implementar permissões individuais diretamente por usuário.

&nbsp;

Se um usuário precisar futuramente de um conjunto diferente de permissões, será criado outro perfil.

&nbsp;

==================================================

2. EMPRESA E VENDEDOR ERP CONTINUAM INDEPENDENTES

==================================================

&nbsp;

O novo Perfil de Permissão NÃO substitui o controle de empresas.

&nbsp;

Continuar usando:

&nbsp;

`user_company_access`

&nbsp;

para definir acesso:

&nbsp;

1 = GRAAL

3 = GROTT

&nbsp;

Exemplo:

&nbsp;

Usuário:

Perfil = Vendedor

Empresas:

- GRAAL = SIM

- GROTT = NÃO

&nbsp;

Outro usuário:

&nbsp;

Perfil = Vendedor

Empresas:

- GRAAL = SIM

- GROTT = SIM

&nbsp;

Da mesma forma, o vendedor ERP continua independente.

&nbsp;

Manter:

&nbsp;

`profiles.erp_seller_id`

&nbsp;

NÃO remover.

NÃO renomear.

NÃO modificar a lógica atual neste sprint.

&nbsp;

==================================================

3. COMPORTAMENTO GLOBAL — VISUALIZAÇÃO

==================================================

&nbsp;

Quando futuramente uma tela for protegida por:

&nbsp;

resource:

`commercial.orders`

&nbsp;

action:

`view`

&nbsp;

e o usuário NÃO possuir permissão:

&nbsp;

A rota deve continuar existindo.

&nbsp;

A aplicação deve abrir normalmente.

&nbsp;

O conteúdo da tela deve ser substituído por um estado visual padronizado:

&nbsp;

"Acesso não permitido"

&nbsp;

"Seu perfil não possui permissão para visualizar esta tela."

&nbsp;

NÃO:

&nbsp;

- redirecionar para dashboard;

- gerar 404;

- esconder a existência da rota;

- fechar sessão;

- desmontar o AppShell.

&nbsp;

A regra global é:

&nbsp;

SEM `view`

→ tela abre

→ conteúdo informa falta de permissão.

&nbsp;

==================================================

4. COMPORTAMENTO GLOBAL — AÇÕES

==================================================

&nbsp;

Se o usuário possui:

&nbsp;

Pedidos.visualizar = SIM

Pedidos.criar = NÃO

&nbsp;

Resultado esperado:

&nbsp;

A tela Pedidos abre normalmente.

&nbsp;

O botão:

&nbsp;

"+ Novo Pedido"

&nbsp;

continua visível.

&nbsp;

Porém:

&nbsp;

- disabled = true;

- não executa onClick;

- possui aparência visual de bloqueado;

- deve suportar `aria-disabled`;

- pode exibir tooltip/title:

&nbsp;

"Você não possui permissão para esta ação."

&nbsp;

O mesmo padrão deve valer para:

&nbsp;

- Criar;

- Editar;

- Deletar.

&nbsp;

IMPORTANTE:

&nbsp;

Botão HTML não possui readonly real.

&nbsp;

Usar `disabled`.

&nbsp;

Não implementar bloqueio somente através de CSS ou `pointer-events`.

&nbsp;

==================================================

5. SEGURANÇA EM CAMADAS

==================================================

&nbsp;

A autorização NÃO pode existir apenas na interface.

&nbsp;

Arquitetura:

&nbsp;

FRONTEND

    ↓

can(resource, action)

    ↓

UX / botão / PermissionGate

&nbsp;

SERVER FUNCTION

    ↓

requirePermission(...)

    ↓

&nbsp;

SUPABASE

    ↓

has_permission(...)

    ↓

RLS / função / banco

&nbsp;

O frontend melhora a experiência.

&nbsp;

O servidor é autoridade.

&nbsp;

Nunca confiar em:

&nbsp;

- botão disabled;

- estado React;

- parâmetro enviado pelo navegador.

&nbsp;

==================================================

6. NOVA MIGRATION

==================================================

&nbsp;

Criar uma NOVA migration em:

&nbsp;

`supabase/migrations/`

&nbsp;

NÃO alterar migrations históricas já aplicadas.

&nbsp;

A migration deve ser idempotente quando tecnicamente adequado, mas sem mascarar erros estruturais.

&nbsp;

==================================================

7. TABELA permission_profiles

==================================================

&nbsp;

Criar:

&nbsp;

`public.permission_profiles`

&nbsp;

Campos:

&nbsp;

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()

- name TEXT NOT NULL

- description TEXT NULL

- active BOOLEAN NOT NULL DEFAULT true

- is_system BOOLEAN NOT NULL DEFAULT false

- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

- created_by UUID NULL REFERENCES auth.users(id)

- updated_by UUID NULL REFERENCES auth.users(id)

&nbsp;

Criar unicidade case-insensitive para nome.

&nbsp;

Preferência:

&nbsp;

índice UNIQUE em:

&nbsp;

lower(name)

&nbsp;

Utilizar o mecanismo existente:

&nbsp;

`public.set_updated_at()`

&nbsp;

para atualização automática de `updated_at`.

&nbsp;

==================================================

8. TABELA permission_resources

==================================================

&nbsp;

Criar:

&nbsp;

`public.permission_resources`

&nbsp;

Campos:

&nbsp;

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()

- key TEXT NOT NULL UNIQUE

- name TEXT NOT NULL

- description TEXT NULL

- parent_id UUID NULL REFERENCES public.permission_resources(id)

- route TEXT NULL

- sort_order INTEGER NOT NULL DEFAULT 0

- active BOOLEAN NOT NULL DEFAULT true

- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

&nbsp;

A coluna:

&nbsp;

`key`

&nbsp;

é a identidade técnica permanente da permissão.

&nbsp;

NÃO utilizar nome visual como chave.

&nbsp;

Exemplo:

&nbsp;

nome:

"Pedidos"

&nbsp;

key:

`commercial.orders`

&nbsp;

A árvore deve aceitar múltiplos níveis.

&nbsp;

==================================================

9. TABELA permission_profile_rules

==================================================

&nbsp;

Criar:

&nbsp;

`public.permission_profile_rules`

&nbsp;

Campos:

&nbsp;

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()

- profile_id UUID NOT NULL REFERENCES public.permission_profiles(id) ON DELETE CASCADE

- resource_id UUID NOT NULL REFERENCES public.permission_resources(id) ON DELETE CASCADE

- can_view BOOLEAN NOT NULL DEFAULT false

- can_create BOOLEAN NOT NULL DEFAULT false

- can_edit BOOLEAN NOT NULL DEFAULT false

- can_delete BOOLEAN NOT NULL DEFAULT false

- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

&nbsp;

Constraint:

&nbsp;

UNIQUE(profile_id, resource_id)

&nbsp;

Adicionar índices necessários para consultas por:

&nbsp;

- profile_id;

- resource_id.

&nbsp;

Utilizar `set_updated_at()`.

&nbsp;

==================================================

10. VINCULAR PERFIL AO USUÁRIO

==================================================

&nbsp;

Adicionar à tabela existente:

&nbsp;

`public.profiles`

&nbsp;

a coluna:

&nbsp;

`permission_profile_id UUID NULL`

&nbsp;

com FK:

&nbsp;

REFERENCES public.permission_profiles(id)

ON DELETE SET NULL

&nbsp;

IMPORTANTE:

&nbsp;

NÃO usar NOT NULL neste momento.

&nbsp;

Existem usuários atuais e a migração será gradual.

&nbsp;

Preservar todas as colunas existentes, incluindo:

&nbsp;

- id;

- full_name;

- active;

- erp_seller_id;

- demais campos existentes.

&nbsp;

==================================================

11. SEED DA ÁRVORE INICIAL

==================================================

&nbsp;

Criar recursos iniciais.

&nbsp;

Árvore:

&nbsp;

ERP OPERACIONAL

&nbsp;

├── Operação

│   ├── Mapa

│   ├── Entregas

│   └── Recolhas

│

├── Comercial

│   ├── Pedidos

│   ├── Aprovações

│   └── Clientes ERP

│

└── Administração

    ├── Usuários

    ├── Perfis de Permissão

    ├── Integração ERP

    ├── Catálogo

    └── Configurações

&nbsp;

Keys:

&nbsp;

operation

operation.map

operation.deliveries

operation.pickups

&nbsp;

commercial

commercial.orders

commercial.order_approvals

commercial.clients

&nbsp;

admin

admin.users

admin.permission_profiles

admin.erp

admin.catalog

admin.settings

&nbsp;

Rotas, quando conhecidas, podem ser registradas em `route`.

&nbsp;

Exemplos atuais:

&nbsp;

operation.deliveries

→ `/entregas`

&nbsp;

operation.pickups

→ `/recolhas`

&nbsp;

commercial.orders

→ `/pedidos-venda`

&nbsp;

commercial.order_approvals

→ `/pedidos-venda/aprovacoes`

&nbsp;

admin.erp

→ `/settings/erp`

&nbsp;

admin.catalog

→ `/settings/catalogo`

&nbsp;

admin.settings

→ `/settings/mapa`

&nbsp;

Não inventar rota para recurso que ainda não possui tela real.

&nbsp;

Nós-pai também devem possuir registro próprio.

&nbsp;

==================================================

12. PERFIL SISTEMA ADMINISTRADOR

==================================================

&nbsp;

Criar perfil:

&nbsp;

name:

`Administrador`

&nbsp;

description:

`Acesso completo ao ERP Operacional`

&nbsp;

active:

true

&nbsp;

is_system:

true

&nbsp;

Criar uma regra para TODOS os recursos seedados:

&nbsp;

can_view = true

can_create = true

can_edit = true

can_delete = true

&nbsp;

==================================================

13. MIGRAR ADMINS EXISTENTES

==================================================

&nbsp;

Depois de criar o perfil Administrador:

&nbsp;

localizar usuários atuais através de:

&nbsp;

`user_roles.role = 'admin'`

&nbsp;

e preencher:

&nbsp;

`profiles.permission_profile_id`

&nbsp;

com o ID do perfil Administrador.

&nbsp;

Isso NÃO remove nem altera:

&nbsp;

- `user_roles`;

- `app_role`;

- `has_role`.

&nbsp;

É apenas preparação para a futura migração.

&nbsp;

==================================================

14. FUNÇÃO has_permission

==================================================

&nbsp;

Criar:

&nbsp;

`public.has_permission(

  _user_id UUID,

  _resource_key TEXT,

  _action TEXT

)`

&nbsp;

RETURNS BOOLEAN

&nbsp;

Requisitos:

&nbsp;

- SECURITY DEFINER;

- SET search_path = public;

- STABLE se tecnicamente adequado;

- retorno seguro padrão = FALSE.

&nbsp;

Ações aceitas:

&nbsp;

- view

- create

- edit

- delete

&nbsp;

Mapeamento:

&nbsp;

view

→ can_view

&nbsp;

create

→ can_create

&nbsp;

edit

→ can_edit

&nbsp;

delete

→ can_delete

&nbsp;

Retornar FALSE quando:

&nbsp;

- `_user_id` for NULL;

- usuário não existir;

- usuário não possuir perfil;

- perfil estiver inativo;

- recurso não existir;

- recurso estiver inativo;

- regra não existir;

- ação for inválida.

&nbsp;

Não lançar exception para ausência normal de permissão.

&nbsp;

Ausência = false.

&nbsp;

==================================================

15. NÃO CRIAR BYPASS DE ADMIN NO NOVO SISTEMA

==================================================

&nbsp;

`has_permission` NÃO deve fazer:

&nbsp;

IF has_role(user, 'admin')

  RETURN true;

&nbsp;

Isso NÃO é desejado.

&nbsp;

No novo sistema o Administrador também deve possuir permissões através do perfil:

&nbsp;

Administrador

→ permission_profile_rules

→ CRUD true.

&nbsp;

Durante a transição:

&nbsp;

Sistema antigo:

`has_role`

&nbsp;

continua funcionando.

&nbsp;

Sistema novo:

`has_permission`

&nbsp;

funciona paralelamente.

&nbsp;

==================================================

16. GRANTS DE has_permission

==================================================

&nbsp;

Após criação:

&nbsp;

REVOKE ALL da função para PUBLIC.

&nbsp;

Conceder somente aos papéis necessários:

&nbsp;

- authenticated;

- service_role, se necessário.

&nbsp;

Evitar exposição para anon.

&nbsp;

==================================================

17. RLS — permission_resources

==================================================

&nbsp;

Ativar RLS.

&nbsp;

Authenticated:

&nbsp;

pode SELECT de recursos ativos necessários para montar/resolver permissões.

&nbsp;

Admin atual, usando:

&nbsp;

`public.has_role(auth.uid(), 'admin')`

&nbsp;

pode:

&nbsp;

- INSERT;

- UPDATE;

- DELETE;

- SELECT administrativo.

&nbsp;

Service Role:

&nbsp;

acesso integral.

&nbsp;

==================================================

18. RLS — permission_profiles

==================================================

&nbsp;

Ativar RLS.

&nbsp;

Usuário autenticado deve conseguir ler somente o perfil necessário para resolver sua própria permissão.

&nbsp;

Admin atual:

&nbsp;

`has_role(auth.uid(), 'admin')`

&nbsp;

pode CRUD completo.

&nbsp;

Service Role:

&nbsp;

acesso integral.

&nbsp;

Evitar disponibilizar desnecessariamente todos os perfis para qualquer usuário comum.

&nbsp;

==================================================

19. RLS — permission_profile_rules

==================================================

&nbsp;

Ativar RLS.

&nbsp;

Usuário autenticado:

&nbsp;

deve conseguir ler regras vinculadas ao seu próprio:

&nbsp;

`profiles.permission_profile_id`

&nbsp;

Admin atual:

&nbsp;

`has_role(auth.uid(), 'admin')`

&nbsp;

pode CRUD completo.

&nbsp;

Service Role:

&nbsp;

acesso integral.

&nbsp;

Cuidado para não introduzir recursão infinita entre policies.

&nbsp;

Se uma policy gerar dependência circular, criar helper SECURITY DEFINER mínimo para resolução do perfil atual em vez de relaxar segurança.

&nbsp;

==================================================

20. PRESERVAR SISTEMA ATUAL DE ROLES

==================================================

&nbsp;

NÃO remover:

&nbsp;

- enum `app_role`;

- `user_roles`;

- `has_role`;

- `useMyRoles`;

- `primaryRole`;

- `AppRole`.

&nbsp;

O sistema atual ainda é utilizado em diferentes partes da aplicação.

&nbsp;

A migração será incremental.

&nbsp;

==================================================

21. TYPES DO SUPABASE

==================================================

&nbsp;

Atualizar:

&nbsp;

`src/integrations/supabase/types.ts`

&nbsp;

para incluir:

&nbsp;

- permission_profiles;

- permission_resources;

- permission_profile_rules;

- profiles.permission_profile_id;

- RPC has_permission.

&nbsp;

Não quebrar tipos existentes.

&nbsp;

Não remover enums antigos.

&nbsp;

==================================================

22. permission-types.ts

==================================================

&nbsp;

Criar:

&nbsp;

`src/lib/permissions/permission-types.ts`

&nbsp;

Definir:

&nbsp;

export type PermissionAction =

  | "view"

  | "create"

  | "edit"

  | "delete";

&nbsp;

Definir também estrutura equivalente a:

&nbsp;

PermissionFlags

&nbsp;

com:

&nbsp;

- view

- create

- edit

- delete

&nbsp;

e:

&nbsp;

PermissionMap

&nbsp;

indexado por resource key.

&nbsp;

==================================================

23. permission-keys.ts

==================================================

&nbsp;

Criar:

&nbsp;

`src/lib/permissions/permission-keys.ts`

&nbsp;

Centralizar as keys.

&nbsp;

Exemplo:

&nbsp;

PERMISSIONS = {

  OPERATION: {

    ROOT: "operation",

    MAP: "operation.map",

    DELIVERIES: "operation.deliveries",

    PICKUPS: "operation.pickups",

  },

&nbsp;

  COMMERCIAL: {

    ROOT: "commercial",

    ORDERS: "commercial.orders",

    APPROVALS: "commercial.order_approvals",

    CLIENTS: "commercial.clients",

  },

&nbsp;

  ADMIN: {

    ROOT: "admin",

    USERS: "admin.users",

    PERMISSION_PROFILES: "admin.permission_profiles",

    ERP: "admin.erp",

    CATALOG: "admin.catalog",

    SETTINGS: "admin.settings",

  },

} as const;

&nbsp;

Evitar strings de permissões espalhadas aleatoriamente pelo projeto.

&nbsp;

==================================================

24. usePermissions

==================================================

&nbsp;

Criar:

&nbsp;

`src/hooks/use-permissions.ts`

&nbsp;

Responsabilidades:

&nbsp;

1. identificar usuário autenticado;

2. obter `profiles.permission_profile_id`;

3. carregar perfil;

4. carregar regras daquele perfil;

5. carregar keys dos recursos;

6. produzir um PermissionMap em memória.

&nbsp;

API desejada:

&nbsp;

const {

  can,

  permissions,

  profile,

  isLoading,

  error

} = usePermissions();

&nbsp;

Uso:

&nbsp;

can(PERMISSIONS.COMMERCIAL.ORDERS, "view")

&nbsp;

can(PERMISSIONS.COMMERCIAL.ORDERS, "create")

&nbsp;

can(PERMISSIONS.COMMERCIAL.ORDERS, "edit")

&nbsp;

can(PERMISSIONS.COMMERCIAL.ORDERS, "delete")

&nbsp;

==================================================

25. CACHE DAS PERMISSÕES

==================================================

&nbsp;

Usar React Query.

&nbsp;

Não executar uma RPC ou SELECT para cada botão.

&nbsp;

As permissões devem ser carregadas uma vez e mantidas em cache.

&nbsp;

Query key deve considerar:

&nbsp;

- userId;

- permission_profile_id.

&nbsp;

Alteração de perfil deve invalidar/refazer a consulta adequadamente.

&nbsp;

Default durante loading:

&nbsp;

FALSE.

&nbsp;

Nunca assumir permissão enquanto a consulta ainda não terminou.

&nbsp;

==================================================

26. PermissionDenied

==================================================

&nbsp;

Criar:

&nbsp;

`src/components/permissions/permission-denied.tsx`

&nbsp;

Componente reutilizável.

&nbsp;

Default visual:

&nbsp;

Título:

&nbsp;

`Acesso não permitido`

&nbsp;

Descrição:

&nbsp;

`Seu perfil não possui permissão para visualizar esta tela.`

&nbsp;

Deve funcionar:

&nbsp;

- desktop;

- mobile.

&nbsp;

Sem redirecionamento.

&nbsp;

Sem logout.

&nbsp;

Sem 404.

&nbsp;

==================================================

27. PermissionGate

==================================================

&nbsp;

Criar:

&nbsp;

`src/components/permissions/permission-gate.tsx`

&nbsp;

API conceitual:

&nbsp;

<PermissionGate

  resource={PERMISSIONS.COMMERCIAL.ORDERS}

  action="view"

>

  ...

</PermissionGate>

&nbsp;

Se permitido:

&nbsp;

renderizar children.

&nbsp;

Se não permitido:

&nbsp;

para `view`, usar PermissionDenied como fallback padrão.

&nbsp;

Também permitir fallback customizado quando necessário.

&nbsp;

Não aplicar este componente em todas as telas ainda.

&nbsp;

Este sprint cria a infraestrutura.

&nbsp;

==================================================

28. PermissionAction

==================================================

&nbsp;

Criar:

&nbsp;

`src/components/permissions/permission-action.tsx`

&nbsp;

Objetivo:

&nbsp;

manter ação visível, porém realmente desabilitada quando não autorizada.

&nbsp;

Exemplo conceitual:

&nbsp;

<PermissionAction

  resource={PERMISSIONS.COMMERCIAL.ORDERS}

  action="create"

>

  <Button>Novo Pedido</Button>

</PermissionAction>

&nbsp;

Sem permissão:

&nbsp;

- Button disabled;

- aria-disabled;

- não executar onClick;

- title/tooltip explicativo.

&nbsp;

IMPORTANTE:

&nbsp;

Implementar de forma segura para os componentes atuais.

&nbsp;

Não assumir que todo child aceita exatamente a mesma API sem validar.

&nbsp;

Pode utilizar `cloneElement`, render prop ou solução equivalente, desde que tipada e estável.

&nbsp;

==================================================

29. HELPER SERVER-SIDE

==================================================

&nbsp;

Criar:

&nbsp;

`src/lib/permissions/permissions.server.ts`

&nbsp;

Implementar helper equivalente a:

&nbsp;

requirePermission({

  userId,

  resource,

  action,

  supabase

})

&nbsp;

IMPORTANTE:

&nbsp;

`userId` deve vir do contexto autenticado do servidor.

&nbsp;

Nunca aceitar como autoridade um userId enviado pelo cliente.

&nbsp;

O helper deve consultar:

&nbsp;

`public.has_permission`

&nbsp;

Se permitido:

&nbsp;

continuar.

&nbsp;

Se negado:

&nbsp;

produzir erro padronizado.

&nbsp;

==================================================

30. ERRO PERMISSION_DENIED

==================================================

&nbsp;

Padronizar:

&nbsp;

status:

403

&nbsp;

code:

`PERMISSION_DENIED`

&nbsp;

message:

&nbsp;

`Você não possui permissão para executar esta ação.`

&nbsp;

details opcional:

&nbsp;

{

  resource,

  action

}

&nbsp;

Não expor:

&nbsp;

- SQL;

- policies;

- detalhes internos do Supabase;

- dados de outros usuários.

&nbsp;

==================================================

31. NÃO APLICAR requirePermission NAS FUNÇÕES EXISTENTES AINDA

==================================================

&nbsp;

Neste sprint:

&nbsp;

criar o helper.

&nbsp;

Testar o helper.

&nbsp;

NÃO começar a alterar todas as Server Functions existentes.

&nbsp;

A aplicação progressiva será feita posteriormente.

&nbsp;

Isso reduz risco de quebrar:

&nbsp;

- criação de cliente;

- pedidos;

- aprovação;

- entregas;

- recolhas.

&nbsp;

==================================================

32. NÃO MIGRAR 