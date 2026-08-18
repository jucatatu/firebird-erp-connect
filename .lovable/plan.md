# Plano de Implementação — SPRINT SELLERS — HOMOLOGAÇÃO FIREBIRD E VÍNCULO DE VENDEDOR AO USUÁRIO

## OBJETIVO
Concluir a homologação real do módulo Sellers usando o schema comprovado no Firebird (`COLABORADORES`, `PESSOAS`) e integrar a seleção de vendedor ERP ao cadastro/edição de usuários administrativos com validação rígida de empresa e status.

## 1. Backend ERP (erp-api)
- **Schema Homologado**: 
  - Tabela `COLABORADORES` (c) JOIN `PESSOAS` (p) ON `c.ID_PESSOA = p.ID_PESSOA`.
  - Filtro: `c.IS_VENDEDOR = 1` AND `c.ID_EMPRESA IN (1, 3)`.
  - Campos: `c.ID_COLABORADORES` (erpSellerId), `c.ID_EMPRESA`, `p.NOME`, `p.APELIDO`.
- **Repository (`sellers.repository.js`)**:
  - `searchSellers({ query, limit, companyId })`: Busca parametrizada por `NOME` ou `APELIDO`.
  - `getSellerById(id)`: Retorna vendedor específico para validação.
- **Controller/Routes**:
  - `GET /api/v1/sellers`: Listagem com filtros de `q` e `companyId`.
  - `GET /api/v1/sellers/:id`: Detalhes de um vendedor.
- **Segurança**: Acesso apenas via `authMiddleware` e ZERO escrita.
- **Testes**: Suíte real cobrindo busca, filtros de empresa e erros (404, 400).

## 2. Frontend (Supabase / Server Functions)
- **Validação de Seller (`admin-users-invite.functions.ts` e `update.functions.ts`)**:
  - Antes de persistir, consulta a `erp-api` via server-side.
  - Valida se o vendedor existe e se sua empresa está contida nas empresas atribuídas ao usuário.
  - Lança `SELLER_NOT_FOUND` ou `SELLER_COMPANY_MISMATCH` conforme o caso.
- **Persistência**: Mantém vínculo em `profiles.erp_seller_id`.
- **UI (`UserDialog.tsx`)**:
  - Substituir input disabled por um `Combobox` ou `Select` que carrega vendedores da `erp-api`.
  - Filtrar lista de vendedores com base nas empresas selecionadas no formulário.
  - Exibir nome amigável ("NOME — EMPRESA").

## 3. Manutenção e Documentação
- **Script (`inspect-sellers-schema.js`)**: Adicionar `require("dotenv").config()` e exit codes corretos.
- **Status**: Atualizar para `SELLERS HOMOLOGADO NO FIREBIRD` após sucesso total.

## TÉCNICO
- **SQL Firebird**: `SELECT c.ID_COLABORADORES, c.ID_EMPRESA, p.NOME, p.APELIDO FROM COLABORADORES c JOIN PESSOAS p ON p.ID_PESSOA = c.ID_PESSOA WHERE c.IS_VENDEDOR = 1 AND c.ID_EMPRESA IN (1,3)`
- **Erros**: Mapeamento de `erp-api` -> Server Function -> Toast UI.
- **Empresas**: IDs 1 (GRAAL) e 3 (GROTT) são as únicas permitidas.
