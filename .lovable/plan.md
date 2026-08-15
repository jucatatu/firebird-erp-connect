# SPRINT 8.9.42 — CADASTRO DE NOVO CLIENTE DIRETO NO ERP

Implementar a funcionalidade de cadastro de novos clientes diretamente no ERP Firebird através do fluxo "Novo Pedido", utilizando procedimentos oficiais e garantindo transações atômicas no backend.

## User Review Required

> [!IMPORTANT]
> A procedure `SP_CAD_CLIENTE_COMPLETO` é posicional (34 parâmetros). O backend Node será atualizado para seguir essa ordem exata.

- **Fluxo**: Wizard de Novo Pedido > Seleção de Cliente > Botão "+ Cadastrar Novo Cliente" > Formulário > Sucesso > Continuar Pedido.
- **Segurança**: Vendedor será resolvido automaticamente via `profiles.erp_seller_id`.
- **Duplicidade**: O backend bloqueará cadastros com CPF/CNPJ já existentes no ERP (409 Conflict).

## Technical Details

### 1. Backend Node.js (`erp-api/`)
- **Novos Módulos**:
    - `src/modules/customer-groups/`: Endpoint read-only `GET /api/v1/customer-groups`.
- **Alterações em `clients`**:
    - `POST /api/v1/clients`: Novo endpoint para criação.
    - `clients.repository.js`: Implementar `createClient` usando `withTransaction`, chamando `SP_CAD_CLIENTE_COMPLETO` e `SP_CAD_CONTATOS`.
    - `clients.repository.js`: Implementar `findByDocument` para check de duplicidade.
    - `clients.validator.js`: Zod schema para validação estrita (PF/PJ, documento normalizado).
    - `clients.mapper.js`: Converter payload camelCase para array posicional da SP.

### 2. Frontend Application
- **Server Functions (`erp-orders.functions.ts`)**:
    - `createErpClient`: Chama o Node autenticado.
    - `getCustomerGroups`: Busca grupos do ERP.
- **Store (`use-order-form.ts`)**:
    - Atualizar para suportar a seleção imediata após o cadastro bem-sucedido.
- **UI Components**:
    - `NewClientForm`: Componente em `Sheet` ou `Dialog` com formulário comercial enxuto.
    - `src/routes/_authenticated.pedidos-venda.novo.tsx`: Integrar o formulário na etapa de cliente.

### 3. Database (Supabase)
- Nenhuma migration de schema necessária.
- Apenas leitura de `profiles` e `user_company_access` para segurança.

## Constraints & Rules
- **Transação**: SP de Cliente e Contatos devem estar na mesma transação Firebird.
- **IDs**: Deixar o ERP gerar via Generators/Triggers.
- **PF/PJ**: Backend converte logicamente para o formato Firebird (JURIDICA null/1).
- **Charset**: Manter WIN1252 via `node-firebird`.
