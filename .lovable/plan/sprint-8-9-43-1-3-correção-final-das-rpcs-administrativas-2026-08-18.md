# SPRINT 8.9.43.1.3 — CORREÇÃO FINAL DAS RPCs ADMINISTRATIVAS
# PLANO COMPLETO CONSOLIDADO

## OBJETIVO
Corrigir exclusivamente os problemas encontrados na revisão final das RPCs administrativas: nome da tabela de empresas, validação SQL de allowlist e restauração de identificadores de erro (HINTs).

## 1. INFRAESTRUTURA E BANCO (Supabase)
### MIGRATION DE CORREÇÃO (Concluído)
- **Tabela de Empresas**: Corrigido de `user_companies` para `user_company_access` em `admin_update_user` e `admin_setup_invited_user`.
- **Validação SQL Robustas**: 
  - Rejeição de `NULL`, array vazio `[]` e IDs fora de `{1, 3}`.
  - Erro com `HINT = 'INVALID_COMPANY_ACCESS'`.
- **Last Admin Protection**: Restaurado `USING HINT = 'LAST_ADMIN_PROTECTION'`.
- **Sincronização Admin**: Mantida a normalização server-side (Perfil Administrador ⇔ Role 'admin').
- **Segurança**: Aplicado `REVOKE EXECUTE` nas RPCs para `PUBLIC` e `authenticated`.

## 2. SERVER FUNCTIONS (Frontend)
### admin-users-update.functions.ts & admin-users-invite.functions.ts (Concluído)
- **Tratamento de Erros**: Refatorado para identificar erros via `hint` ou `code`.
- **Tradução**: Mensagens amigáveis para `INVALID_COMPANY_ACCESS`.
- **Imutabilidade**: Preservado `erpSellerId` e validações Zod.

## 3. VALIDAÇÃO
- **Testes**: Executada suíte `admin-sync.test.ts` (7/7 passed).
- **Typecheck**: Build e tipos 100% limpos.
- **Inspeção de Schema**: Confirmado zero uso de `user_companies`.

## STATUS
- **SELLERS PENDENTE DE HOMOLOGAÇÃO FIREBIRD.**
- **ZERO escrita Firebird.**
- **Novo Cliente / Pedido / Mapa: NÃO ALTERADOS.**

PARAR.
