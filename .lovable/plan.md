# Plano de Implementação — Sprint 8.9.43.1.1 — Hardening Administrativo

Este plano foca no endurecimento (hardening) do sistema administrativo, corrigindo falhas técnicas de concorrência, protegendo perfis de sistema no servidor e garantindo que as queries administrativas sejam executadas apenas após a validação de permissão na UI.

## 1. Segurança e Banco de Dados (Supabase)

### Nova Migration Corretiva
Criar uma nova migration para refatorar as RPCs administrativas com locks transacionais e validações rígidas:

- **Lock Transacional**: Utilizar `pg_advisory_xact_lock(7142026)` (chave fixa para admin lock) no início das RPCs `admin_update_user` e `admin_setup_invited_user`.
- **Atomicidade Real**: Recalcular a contagem de administradores ativos *após* adquirir o lock para evitar race conditions na regra `LAST_ADMIN_PROTECTION`.
- **Allowlist de Empresas**: Validar no banco de dados que `company_id` pertence exclusivamente ao conjunto `{1, 3}`. Lançar `INVALID_COMPANY_ACCESS` caso contrário.
- **Proteção do Perfil Administrador**: Impedir alterações de `name`, `active` e `is_system` via RPC caso o perfil seja marcado como `is_system`.

## 2. Server Functions (Backend Logic)

### Refatoração de Usuários
- **Zod Validation**: Atualizar `inviteUser` e `updateUser` para restringir o array de empresas aos valores `1` e `3`.
- **Gestão de Sellers**: Garantir que `erpSellerId` seja tratado como imutável se o schema não for descoberto.

### Refatoração de Perfis
- **updatePermissionProfile**: Adicionar trava server-side que impede a alteração de `name`, `active` e `is_system` para perfis com `is_system: true`. Lançar `SYSTEM_PROFILE_PROTECTED`.
- **saveProfileRules**: Garantir que para o perfil "Administrador", nenhuma regra de CRUD possa ser desativada (`false`).

## 3. Interface Administrativa (Frontend)

### Reestruturação de Rotas (PermissionGate)
Corrigir a execução de queries antes da autorização:
- **AdminUsersPage**: Mover `useSuspenseQuery(listAdminUsers)` para um sub-componente `AdminUsersContent` renderizado dentro do `PermissionGate`.
- **AdminProfilesPage**: Mover `useSuspenseQuery(listPermissionProfiles)` para um sub-componente `AdminProfilesContent` renderizado dentro do `PermissionGate`.

## 4. Testes e Validação

### Novos Testes de Cobertura
- Criar `src/lib/permissions/__tests__/admin-hardening.test.ts` para validar:
  - Proteção contra desativação do último admin.
  - Rejeição de IDs de empresa inválidos.
  - Proteção de campos do perfil "Administrador".
  - Comportamento de travamento de sellers.

## Detalhes Técnicos

- **Lock Key**: `7142026` (representa "ADMIN" em formato numérico).
- **ErrorCode**: `LAST_ADMIN_PROTECTION` e `INVALID_COMPANY_ACCESS`.
- **Permission Mapping**: Sincronização Perfil Administrador <=> Role `admin` mantida e reforçada no banco.

**SELLERS PENDENTE DE HOMOLOGAÇÃO FIREBIRD.**
**PARAR.**
