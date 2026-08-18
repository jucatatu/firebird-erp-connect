# Sprint HOTFIX ADMIN USERS.1 — TROCA DE SENHA SEGURA E CLEANUP FINAL

## Objetivos
Corrigir o fluxo de primeiro acesso de usuários com senha temporária, centralizando a lógica de troca de senha no server-side para garantir segurança e atomicidade.

## Etapas
1. **Banco de Dados (Migration Corretiva)**
   - Remover a RPC `complete_initial_password_change` que era acessível pelo cliente.
   - Garantir que a flag `must_change_password` só possa ser alterada via lógica administrativa segura.

2. **Server Functions (Segurança Server-Side)**
   - Implementar `changeInitialPassword` em `src/lib/permissions/password-change.functions.ts`.
   - Validar senha, confirmação e sessão (`context.userId`).
   - Usar `supabaseAdmin.auth.admin.updateUserById` para atualizar a senha.
   - Atualizar `profiles.must_change_password = false` apenas após o sucesso do Auth.

3. **Backend Refactoring (Criação de Usuário)**
   - Refatorar `createAdminUser` para validar o `permissionProfileId` antes de chamar o `auth.admin.createUser`.
   - Incluir validação de `confirmPassword` no server-side.

4. **Frontend (Integração e Tipagem)**
   - Atualizar `ForcePasswordChange.tsx` para usar a nova Server Function.
   - Regenerar ou atualizar manualmente `src/integrations/supabase/types.ts` com a coluna `must_change_password`.
   - Remover casts `as any` em `create-client-form.tsx`, `pedidos-venda.novo.tsx` e `_authenticated.tsx`.

5. **Cleanup**
   - Remover `src/lib/permissions/admin-users-invite.functions.ts.deprecated`.

## Detalhes Técnicos
- **Validação de Senha**: Mínimo 8 caracteres, não aceitar apenas espaços.
- **Identidade**: O ID do usuário na troca de senha será obtido via `context.userId` (session), nunca via payload do browser.
- **Idempotência e Segurança**: A flag de troca de senha só é limpa se a alteração no Auth for confirmada.

## Testes
- Cobrir `changeInitialPassword` com casos de sucesso, senha curta, senhas divergentes e falha na atualização do profile.
- Validar regressões em `admin-create-user` (perfil inválido, seller mismatch, e-mail duplicado).
