# SPRINT SELLERS.1 — HOTFIX FINAL DE CONTRATO E INTEGRAÇÃO ADMINISTRATIVA

## OBJETIVO
Corrigir exclusivamente os problemas encontrados na revisão Git após a implementação do módulo Sellers, garantindo integridade de contratos, isolamento de módulos e segurança no convite de usuários.

## Ações Técnicas

### 1. ERP API (Backend Node)
- **Contrato JSON**: Ajustar `sellers.controller.js` para responder `{ success: true, data: { sellers: [...] } }` na listagem e `{ success: true, data: { seller: {...} } }` no detalhe.
- **Resiliência**: Manter validações Zod existentes e garantir que erros de banco/ERP não sejam mascarados como "não encontrado".

### 2. Frontend & Server Functions
- **Isolamento**: Criar `src/lib/erp-sellers.functions.ts` e mover lógica de vendedores de `erp-orders.functions.ts`.
- **Restauração**: Restaurar `src/lib/erp-orders.functions.ts` ao estado funcional original (commit `75a8ed9b`).
- **Remoção de Temporários**: Excluir `src/lib/erp-orders.functions.ts.temp`.
- **Validação de Vendedor**:
  - Criar helper `validateErpSellerForCompanies` para validar vendedor, empresa e disponibilidade do ERP.
  - Ajustar schemas administrativos (Invite/Update) para `z.number().int().positive().nullable()`.
  - Corrigir fluxo de **Invite**: Validar vendedor e empresas ANTES de enviar o e-mail de convite.
  - Corrigir fluxo de **Update**: Permitir troca/remoção e validar compatibilidade.

### 3. Interface (Admin)
- **UserDialog**:
  - Ajustar Combobox para usar o novo módulo `erp-sellers.functions.ts`.
  - Remover limpeza silenciosa de `erpSellerId` ao trocar empresas (bloquear salvamento em vez disso).
  - Exibir Nome — Empresa (GRAAL/GROTT).

### 4. Testes e Qualidade
- **Backend**: Novos testes para contratos JSON, limites e filtros, tratando 503 como falha real.
- **Server Functions**: Testes cobrindo SELLER_NOT_FOUND, SELLER_COMPANY_MISMATCH e ERP_UNAVAILABLE.
- **Invite**: Teste específico garantindo que e-mail NÃO é enviado se o vendedor for inválido ou ERP estiver offline.

## Invariantes
- **ZERO escrita no Firebird**.
- **NÃO alterar Mapa, Pedidos ou Cadastro de Clientes**.
- **NÃO alterar RPCs Supabase ou Migrations**.
- **NÃO alterar callErp() globalmente**.

Status final: **SELLERS IMPLEMENTADO — AGUARDANDO HOMOLOGAÇÃO LOCAL FIREBIRD**
