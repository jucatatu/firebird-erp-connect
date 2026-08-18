# SPRINT 8.9.43.1.3 — CORREÇÃO FINAL DAS RPCs ADMINISTRATIVAS
# PLANO COMPLETO CONSOLIDADO

## OBJETIVO
Corrigir exclusivamente os problemas encontrados na revisão final das RPCs administrativas, garantindo atomicidade, segurança e integridade referencial das empresas.

## 1. INFRAESTRUTURA E BANCO (Supabase)
### MIGRATION DE CORREÇÃO (20260818132400_rpc_fix_final.sql)
- **Tabela de Empresas**: Corrigido de `user_companies` para `user_company_access`.
- **Atomicidade**: A migration migrou dados residuais (se houvesse) e removeu a tabela incorreta.
- **Validação de Empresas**: Implementada lógica robusta:
  - `cardinality(_company_ids) = 0` (rejeita array vazio).
  - `EXISTS (... cid NOT IN (1, 3))` (rejeita IDs fora da allowlist GRAAL/GROTT).
  - Lançamento de erro com `HINT = 'INVALID_COMPANY_ACCESS'`.
- **Last Admin Protection**: Restaurado `USING HINT = 'LAST_ADMIN_PROTECTION'` para identificação programática.
- **Normalização Admin**: Mantida a invariante Perfil Administrador <=> Role 'admin'.
- **Segurança**: Aplicados `REVOKE EXECUTE` para `PUBLIC` e `authenticated`, com `GRANT` apenas para `service_role`.

## 2. SERVER FUNCTIONS (Frontend)
### src/lib/permissions/admin-users-update.functions.ts
- **Tratamento de Erros**: Refatorado para capturar `error.hint` ou `(error as any).code`.
- **Mapping**: Tradução de `INVALID_COMPANY_ACCESS` para mensagem legível para o usuário final.
- **Last Admin**: Preservada a lógica de identificação programática via `code`.

### src/lib/permissions/admin-users-invite.functions.ts
- **Tratamento de Erros**: Adicionada captura de `INVALID_COMPANY_ACCESS` com rollback (delete user) em caso de falha de configuração inicial.

## 3. TESTES E VALIDAÇÃO
- **Vitest**: Atualizado `admin-sync.test.ts` para cobrir os novos casos de erro (`INVALID_COMPANY_ACCESS`).
- **Resultados**: 7 testes aprovados (100% sucesso).
- **Typecheck**: Validado com `tsc --noEmit`.

## STATUS FINAL
- **user_companies**: 0 ocorrências.
- **user_company_access**: Integrado.
- **Allowlist Empresas**: 1 (GRAAL), 3 (GROTT).
- **SELLERS PENDENTE DE HOMOLOGAÇÃO FIREBIRD.**
- **ZERO escrita Firebird.**
- **Fluxos Wizard/Mapa/Entregas: Intactos.**

## PRÓXIMOS PASSOS
1. Publicar para aplicar as mudanças de RPC no banco de dados.
2. Aguardar homologação do Firebird para Sellers.

PARAR.
