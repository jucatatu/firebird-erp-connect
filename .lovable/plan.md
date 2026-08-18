# Plano de Implementação — Sprint 8.9.43.1 — Administração de Usuários e Perfis

Implementação da gestão administrativa de usuários, perfis de permissão e integração de vendedores ERP, consolidando o núcleo de permissões homologado na Sprint anterior.

## 1. Segurança e Banco de Dados (Supabase)

- **Migration de Segurança**:
  - Atualizar `public.has_permission` e `public.has_role` para validar `profiles.active = true`.
  - Garantir `SECURITY DEFINER` e `search_path = public`.
- **Proteção do Último Admin**: Validação server-side para impedir a desativação ou remoção de privilégios do único administrador ativo remanescente.

## 2. Backend ERP (Node.js API)

- **Descoberta de Vendedores**: Script de introspecção para identificar a tabela real de vendedores no Firebird (candidatos: `VENDEDORES`, `FUNCIONARIOS`).
- **Novo Módulo `sellers`**:
  - `GET /api/v1/sellers`: Endpoint read-only com busca (`q`) e limite.
  - Integração HMAC e validação Zod.
  - Testes unitários e de integração no Node.

## 3. Server Functions (TanStack Start)

- **Módulo Administrativo**:
  - `admin-users.functions.ts`: `listUsers`, `inviteUser`, `updateUser`, `setUserActive`.
  - `admin-profiles.functions.ts`: `listProfiles`, `createProfile`, `updateProfile`, `saveRules`, `deleteProfile`.
  - `erp-sellers.functions.ts`: `searchSellers` (proxy HMAC para o Node).
- **Controle de Acesso**: Uso obrigatório de `requirePermission` em todas as funções.

## 4. Frontend e Interface (React)

- **Navegação**:
  - Habilitar `/admin/users` no Sidebar.
  - Adicionar `/admin/permission-profiles`.
  - Sidebar gerido por `adminOnly` durante a transição.
- **Telas**:
  - **Usuários**: Listagem (Tabela/Cards), filtros, badges de status/empresa e formulário de edição/convite.
  - **Perfis**: Editor de árvore organizacional com matriz CRUD (Visualizar, Criar, Editar, Deletar).
  - **Bloqueio de Inativos**: Guard de rota em `_authenticated.tsx` para redirecionar usuários desativados.

## 5. Compatibilidade Legada

- Manutenção da tabela `user_roles` (`admin`, `vendedor`, `aprovador`).
- Sincronização obrigatória: Perfil "Administrador" <=> legacy role "admin".

## Detalhes Técnicos

- **Tecnologias**: TanStack Start, Supabase RLS, Zod, Firebird (node-firebird).
- **Proteção de Dados**: IDs sensíveis (Service Role) isolados no server-side.
- **UX**: Debounce na busca de vendedores, estados de loading e tratamento de erros administrativos (ex: `LAST_ADMIN_PROTECTION`).
