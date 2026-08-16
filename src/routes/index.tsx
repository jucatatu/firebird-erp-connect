import { createFileRoute } from '@tanstack/react-router'

const content = `Execute esta instrucao no projeto: SPRINT 8.9.43 — NÚCLEO DE PERMISSÕES POR ÁRVORE

OBJETIVO

Criar a fundação do novo sistema de autorização do ERP Operacional usando:

- perfis de permissão;
- árvore hierárquica de recursos/telas;
- quatro ações por recurso:
  - visualizar
  - criar
  - editar
  - deletar
- um perfil de permissão vinculado a cada usuário;
- helpers reutilizáveis para frontend e backend;
- compatibilidade total com o sistema atual de roles.

IMPORTANTE:
Este sprint NÃO deve migrar todas as telas existentes para o novo modelo ainda.
Não remover user_roles.
Não remover has_role.
Não alterar as RLS atuais de pedidos/aprovações.
Não alterar o fluxo Novo Cliente / Novo Pedido / Entrega já homologado.
Não alterar regras de empresa Graal/Grott.
Não alterar criação de pedidos no ERP.

A migração efetiva das telas ocorrerá em sprint posterior.

==================================================
1. REGRA FUNCIONAL DEFINITIVA
==================================================

O novo modelo será:

USUÁRIO
  ↓
PERFIL DE PERMISSÃO
  ↓
ÁRVORE DE RECURSOS
  ↓
VISUALIZAR / CRIAR / EDITAR / DELETAR

Cada usuário terá UM perfil de permissão.

Exemplos futuros de perfis:

- Administrador
- Vendedor
- Entregador
- Financeiro
- Consulta
- Comercial

Não implementar permissões individuais diretamente no usuário neste sprint.

Acesso às empresas continua independente através da tabela existente:

user_company_access

O vínculo de vendedor ERP continua independente através de:

profiles.erp_seller_id

==================================================
2. COMPORTAMENTO GLOBAL QUE O NOVO SISTEMA DEVERÁ SUPORTAR
==================================================

Estas regras devem ser consideradas desde já no design dos helpers:

A) SEM PERMISSÃO DE VISUALIZAR

A rota NÃO deve ser removida.
A opção de menu NÃO deverá necessariamente ser escondida.

Quando uma tela futuramente for protegida por:

resource = "commercial.orders"
action = "view"

e o usuário não possuir essa permissão, a rota deve abrir e renderizar um estado padronizado:

"Você não possui permissão para visualizar esta tela."

Não redirecionar para dashboard.
Não gerar 404.
Não desmontar toda a aplicação.

B) SEM PERMISSÃO DE AÇÃO

Se o usuário puder visualizar uma tela mas não puder criar, editar ou deletar:

- botão continua visível;
- botão fica desabilitado;
- deve possuir aparência de ação bloqueada;
- opcionalmente tooltip:
  "Você não possui permissão para esta ação."

Exemplo:

Pedidos:
Visualizar = SIM
Criar = NÃO

Resultado:

A tela de pedidos abre normalmente.
O botão "+ Novo Pedido" continua visível, porém desabilitado.

IMPORTANTE:
Usar disabled para botões. Botão HTML não possui readonly real.

C) SEGURANÇA

A autorização NÃO poderá existir somente no frontend.

Arquitetura desejada:

UI
 ↓
verifica permissão

Server Function / ação server-side
 ↓
verifica novamente

Supabase/RLS/RPC quando aplicável
 ↓
proteção final

Neste sprint criar a infraestrutura para isso.
Não migrar ainda todas as Server Functions existentes.

==================================================
3. NOVAS TABELAS
==================================================

Criar migration nova, sem alterar migrations antigas.

3.1 permission_profiles

Criar:

public.permission_profiles

Campos:

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- name TEXT NOT NULL
- description TEXT NULL
- active BOOLEAN NOT NULL DEFAULT true
- is_system BOOLEAN NOT NULL DEFAULT false
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
- created_by UUID NULL REFERENCES auth.users(id)
- updated_by UUID NULL REFERENCES auth.users(id)

Regras:

- nome obrigatório;
- nome único case-insensitive, preferencialmente por índice em lower(name);
- usar trigger padrão set_updated_at() já existente.

3.2 permission_resources

Criar:

public.permission_resources

Campos:

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- key TEXT NOT NULL UNIQUE
- name TEXT NOT NULL
- description TEXT NULL
- parent_id UUID NULL REFERENCES permission_resources(id)
- route TEXT NULL
- sort_order INTEGER NOT NULL DEFAULT 0
- active BOOLEAN NOT NULL DEFAULT true
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

key será a identidade técnica estável.

Nunca usar o nome visual como chave de autorização.

Exemplos:

operation
operation.map
operation.deliveries
operation.pickups

commercial
commercial.orders
commercial.order_approvals

admin
admin.users
admin.permission_profiles
admin.erp
admin.catalog
admin.settings

A estrutura deve permitir árvore com quantos níveis forem necessários.

3.3 permission_profile_rules

Criar:

public.permission_profile_rules

Campos:

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- profile_id UUID NOT NULL REFERENCES permission_profiles(id) ON DELETE CASCADE
- resource_id UUID NOT NULL REFERENCES permission_resources(id) ON DELETE CASCADE
- can_view BOOLEAN NOT NULL DEFAULT false
- can_create BOOLEAN NOT NULL DEFAULT false
- can_edit BOOLEAN NOT NULL DEFAULT false
- can_delete BOOLEAN NOT NULL DEFAULT false
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Constraint:

UNIQUE(profile_id, resource_id)

Usar trigger set_updated_at().

==================================================
4. VÍNCULO DO PERFIL AO USUÁRIO
==================================================

Adicionar à tabela existente:

public.profiles

coluna:

permission_profile_id UUID NULL
REFERENCES public.permission_profiles(id)
ON DELETE SET NULL

IMPORTANTE:

Não tornar NOT NULL ainda.

Temos usuários existentes e precisamos de migração progressiva.

Não remover:

- full_name
- active
- erp_seller_id
- qualquer coluna existente.

==================================================
5. PERFIL SISTEMA "ADMINISTRADOR"
==================================================

Criar via migration um perfil:

name = "Administrador"
description = "Acesso completo ao ERP Operacional"
active = true
is_system = true

Esse perfil deve possuir:

can_view   = true
can_create = true
can_edit   = true
can_delete = true

para TODOS os recursos seedados neste sprint.

Após criar o perfil Administrador:

vincular profiles.permission_profile_id a esse perfil para usuários que atualmente possuam:

user_roles.role = 'admin'

IMPORTANTE:

Isso NÃO substitui user_roles.
É somente preparação para a migração futura.

==================================================
6. SEED INICIAL DA ÁRVORE
==================================================

Criar recursos correspondentes às áreas atuais da aplicação.

Estrutura inicial sugerida:

ERP Operacional
|
|-- Operação
|   |-- Mapa
|   |-- Entregas
|   \`-- Recolhas
|
|-- Comercial
|   |-- Pedidos
|   |-- Aprovações
|   \`-- Novo Cliente ERP
|
\`-- Administração
    |-- Usuários
    |-- Perfis de Permissão
    |-- Integração ERP
    |-- Catálogo
    \`-- Configurações

Usar keys técnicas estáveis:

operation
operation.map
operation.deliveries
operation.pickups

commercial
commercial.orders
commercial.order_approvals
commercial.clients

admin
admin.users
admin.permission_profiles
admin.erp
admin.catalog
admin.settings

Para nós-pai como operation, commercial e admin, manter também as quatro flags no modelo.

Não criar nova tabela toda vez que uma tela nova surgir.
Novas telas serão apenas novos registros em permission_resources.

==================================================
7. FUNÇÃO SQL has_permission
==================================================

Criar função:

public.has_permission(
  _user_id UUID,
  _resource_key TEXT,
  _action TEXT
)
RETURNS BOOLEAN

Requisitos:

- SECURITY DEFINER;
- SET search_path = public;
- STABLE se tecnicamente adequado;
- retornar false se:
  - usuário não existir;
  - perfil não estiver atribuído;
  - perfil estiver inativo;
  - recurso não existir;
  - recurso estiver inativo;
  - regra não existir;
  - ação for inválida.

Ações aceitas:

view
create
edit
delete

Mapeamento:

view   -> can_view
create -> can_create
edit   -> can_edit
delete -> can_delete

Não lançar erro para ausência de regra.
Default seguro = FALSE.

IMPORTANTE:

Administradores também devem passar pelo perfil Administrador no novo sistema.

Não adicionar bypass mágico baseado em user_roles.admin dentro de has_permission, porque queremos que no futuro a fonte de verdade seja o perfil.

Durante a transição, user_roles continua sendo usado pelas funcionalidades antigas.

Revogar execução pública e conceder somente aos papéis necessários.

==================================================
8. RLS DAS NOVAS TABELAS
==================================================

Ativar RLS em:

permission_profiles
permission_resources
permission_profile_rules

Durante ESTE sprint, usar o sistema atual de admin (has_role(auth.uid(), 'admin')) para administrar essas estruturas.

Motivo:

Ainda estamos construindo o novo sistema.
Não podemos fazer o próprio sistema de permissões depender de permissões ainda não configuradas.

Regras desejadas:

permission_profiles:
- authenticated pode ler perfis necessários para resolução do próprio acesso;
- admin pode CRUD.

permission_resources:
- authenticated pode SELECT dos recursos ativos;
- admin pode CRUD.

permission_profile_rules:
- usuário autenticado deve conseguir obter as regras do SEU próprio perfil;
- admin pode CRUD.

Evitar exposição desnecessária de dados administrativos.

Manter service_role com acesso integral.

==================================================
9. TYPES SUPABASE
==================================================

Atualizar os tipos TypeScript do Supabase após a migration.

Precisamos tipagem para:

permission_profiles
permission_resources
permission_profile_rules
profiles.permission_profile_id
RPC has_permission

Não quebrar tipos existentes.

==================================================
10. NOVA CAMADA FRONTEND DE PERMISSÕES
==================================================

Criar estrutura reutilizável, por exemplo:

src/lib/permissions/
  permission-types.ts
  permission-keys.ts

src/hooks/
  use-permissions.ts

src/components/permissions/
  permission-denied.tsx
  permission-gate.tsx
  permission-action.tsx

Os nomes podem variar se houver padrão melhor no projeto.

10.1 Tipos

Criar:

type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete";

type PermissionMap = Record<
  string,
  {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  }
>;

10.2 Chaves centralizadas

Não espalhar strings arbitrárias pelas telas.

Criar constantes centralizadas, exemplo:

PERMISSIONS = {
  OPERATION: {
    MAP: "operation.map",
    DELIVERIES: "operation.deliveries",
    PICKUPS: "operation.pickups",
  },

  COMMERCIAL: {
    ORDERS: "commercial.orders",
    APPROVALS: "commercial.order_approvals",
    CLIENTS: "commercial.clients",
  },

  ADMIN: {
    USERS: "admin.users",
    PERMISSION_PROFILES: "admin.permission_profiles",
    ERP: "admin.erp",
    CATALOG: "admin.catalog",
    SETTINGS: "admin.settings",
  },
};

==================================================
11. usePermissions
==================================================

Criar hook centralizado para usuário autenticado.

Ele deve carregar de forma eficiente:

profiles.permission_profile_id

+
permission_profile_rules

+
permission_resources.key

e produzir mapa local de permissões.

API desejada:

const {
  can,
  permissions,
  profile,
  isLoading,
  error
} = usePermissions();

Uso:

can("commercial.orders", "view")
can("commercial.orders", "create")
can("commercial.orders", "edit")
can("commercial.orders", "delete")

Se ainda estiver carregando:

não assumir permissão.

Default seguro = false.

Evitar uma query SQL/RPC a cada botão.
Carregar as permissões do perfil uma vez e usar cache React Query.

Query key deve incluir userId / permissionProfileId.

==================================================
12. COMPONENTE PermissionDenied
==================================================

Criar componente visual reutilizável.

Exemplo:

<PermissionDenied
  title="Acesso não permitido"
  description="Seu perfil não possui permissão para visualizar esta tela."
/>

Visual consistente com o sistema.

Deve funcionar bem em mobile e desktop.

Não redirecionar automaticamente.

==================================================
13. COMPONENTE PermissionGate
==================================================

Criar componente reutilizável:

<PermissionGate
  resource="commercial.orders"
  action="view"
>
  ...
</PermissionGate>

Comportamento:

se permitido:
renderiza children.

se não permitido:
para action=view, permitir fallback com PermissionDenied.

Não aplicar ainda automaticamente em todas as rotas.

==================================================
14. AÇÕES DESABILITADAS
==================================================

Criar helper/componente reutilizável para ações.

Exemplo conceitual:

<PermissionAction
  resource="commercial.orders"
  action="create"
>
  <Button>Novo pedido</Button>
</PermissionAction>

Resultado quando não permitido:

- botão continua visível;
- disabled=true;
- não dispara onClick;
- aria-disabled;
- tooltip ou title explicando ausência de permissão.

IMPORTANTE:

Não usar CSS com pointer-events apenas.
O elemento deve estar efetivamente disabled quando suportado.

==================================================
15. SERVER-SIDE HELPER
==================================================

Criar helper central para futuras Server Functions.

Exemplo conceitual:

requirePermission({
  userId,
  resource: "commercial.orders",
  action: "create"
});

ou equivalente adequado à arquitetura existente.

Ele deve consultar has_permission.

Quando negado:

retornar/lançar erro padronizado 403:

code:
PERMISSION_DENIED

message:
"Você não possui permissão para executar esta ação."

details opcionais:

resource
action

NÃO aplicar ainda em todas as funções existentes.

Apenas criar a infraestrutura e testes.

==================================================
16. NÃO ALTERAR NESTE SPRINT
==================================================

NÃO fazer agora:

- não remover AppRole;
- não remover useMyRoles;
- não remover primaryRole;
- não remover user_roles;
- não remover has_role;
- não alterar RLS de order_drafts;
- não alterar aprovação;
- não alterar criação de pedidos;
- não alterar filtros Graal/Grott;
- não alterar user_company_access;
- não alterar fluxo Novo Cliente;
- não alterar CreateClientForm;
- não alterar Google Maps;
- não alterar Node ERP API;
- não criar endpoint de vendedores ainda;
- não criar tela completa de usuários ainda;
- não criar tela completa de perfis ainda;
- não esconder menu por permissões novas ainda;
- não migrar sidebar atual para o novo sistema ainda.

Essas etapas ficam para o Sprint 8.9.43.1 e 8.9.43.2.

==================================================
17. COMPATIBILIDADE COM O SISTEMA ATUAL
==================================================

O layout _authenticated.tsx atualmente depende de:

useMyRoles
primaryRole
isAdmin

Manter funcionando exatamente como está.

O AppSidebar atualmente usa role/adminOnly.

Não substituir isso neste sprint.

A fundação nova deve coexistir com o modelo atual.

Objetivo:

SISTEMA ANTIGO
user_roles
has_role
   +
SISTEMA NOVO
permission_profile
permission_resources
permission_rules
has_permission

coexistindo temporariamente.

==================================================
18. TESTES
==================================================

Adicionar testes para pelo menos:

1. has_permission retorna true para regra permitida;
2. retorna false para regra negada;
3. retorna false quando usuário não possui perfil;
4. retorna false para perfil inativo;
5. retorna false para recurso inexistente;
6. retorna false para ação inválida;
7. Administrador seedado possui CRUD completo;
8. usuário admin existente recebe permission_profile_id do Administrador;
9. can() frontend resolve corretamente o mapa;
10. PermissionGate mostra conteúdo permitido;
11. PermissionGate mostra PermissionDenied quando view=false;
12. PermissionAction deixa botão disabled quando ação=false;
13. helper server-side produz PERMISSION_DENIED / 403.

Evitar testes dependentes de Firebird.

Este sprint é Supabase + frontend.

==================================================
19. CRITÉRIOS DE ACEITE
==================================================

O sprint só está concluído se:

[ ] migration nova criada;
[ ] permission_profiles funcionando;
[ ] permission_resources funcionando;
[ ] permission_profile_rules funcionando;
[ ] profiles.permission_profile_id criado;
[ ] perfil Administrador seedado;
[ ] recursos iniciais seedados;
[ ] regras CRUD completas do Administrador seedadas;
[ ] admins atuais vinculados ao perfil Administrador;
[ ] has_permission funcionando;
[ ] RLS das novas tabelas funcionando;
[ ] tipos Supabase atualizados;
[ ] hook usePermissions funcionando;
[ ] PermissionDenied criado;
[ ] PermissionGate criado;
[ ] helper para ações disabled criado;
[ ] helper server-side criado;
[ ] testes adicionados;
[ ] build passando;
[ ] lint sem novos erros críticos;
[ ] testes passando;
[ ] nenhum fluxo atual de pedidos/clientes alterado.

==================================================
20. ENTREGA
==================================================

Ao terminar, não avançar automaticamente para Sprint 8.9.43.1.

Entregar resumo contendo:

1. migrations criadas;
2. tabelas criadas;
3. funções SQL criadas;
4. recursos seedados;
5. comportamento de has_permission;
6. arquivos frontend criados;
7. testes criados;
8. resultado de build/lint/test;
9. confirmação explícita de que:
   - user_roles foi preservado;
   - has_role foi preservado;
   - fluxo de Novo Cliente não foi alterado;
   - fluxo de Novo Pedido não foi alterado;
   - RLS antigas não foram modificadas.

Se durante a implementação for encontrado conflito estrutural com o schema atual, interromper a mudança destrutiva e informar o conflito antes de improvisar uma solução.`

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
