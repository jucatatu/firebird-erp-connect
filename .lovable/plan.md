# SPRINT 8.9.42.1 — FINALIZAÇÃO DO CADASTRO DE NOVO CLIENTE

## OBJETIVO
Aprimorar o formulário de cadastro de cliente diretamente no ERP, adicionando campos financeiros obrigatórios (Condição e Forma de Pagamento), integração com Google Maps para endereço, e ajuste no fluxo de confirmação pós-cadastro.

## ALTERAÇÕES

### 1. Schema do Formulário (`src/components/client/create-client-form.tsx`)
- Aumentar limite de `name` e `tradeName` para 100 caracteres.
- Adicionar `paymentTermId` e `paymentMethodId` como campos numéricos obrigatórios.
- Adicionar `address.zip` e `address.complement` (opcionais no formulário, mas presentes no schema).
- Tornar `mobile` obrigatório e `phone` opcional.

### 2. UI do Formulário (`src/components/client/create-client-form.tsx`)
- **Organização por Seções**:
    - DADOS DO CLIENTE
    - COMERCIAL (Grupo, Empresa read-only, Vendedor read-only)
    - FINANCEIRO (Condição de Pagamento, Forma de Pagamento - via `useErpPaymentOptions`)
    - CONTATO (WhatsApp/Celular, Telefone, E-mail)
    - ENDEREÇO (Busca Google + Campos Manuais)
- **Integração Google Maps**:
    - Reutilizar padrão de `loadGoogleMapsLibraries` e `AutocompleteSuggestion`.
    - Campo de busca com debounce de 400ms.
    - Preenchimento automático de campos de endereço (Rua, Bairro, Cidade, UF-2 char, CEP).
    - Campo de Número permanece editável e obrigatório.

### 3. Fluxo de Submissão e Wizard
- Remover hardcodes `paymentTermId: 1` e `paymentMethodId: 1`.
- Texto do botão: "Cadastrar cliente" / "Salvando no ERP...".
- **Alteração no Wizard (`_authenticated.pedidos-venda.novo.tsx`)**:
    - Substituir o `onSuccess` automático por um estado de confirmação visual.
    - Exibir banner: "✓ CLIENTE CADASTRADO NO ERP".
    - Botão: "Gerar novo pedido para este cliente" chamando `newOrderFromClient`.

## DETALHES TÉCNICOS
- **Google Maps**: Utilizar `AutocompleteSessionToken` e predições com `includedRegionCodes: ["br"]`.
- **UF**: Garantir mapeamento de `administrative_area_level_1` (long) para 2 caracteres (SC, SP, etc) usando `shortText`.
- **Vendedor**: Resolver apenas o nome do usuário logado para exibição visual (ex: "Romeu Effting / automático").
- **Financeiro**: Ignorar `saleTypes` no cadastro do cliente (regra do pedido).

## ARQUIVOS AFETADOS
- `src/components/client/create-client-form.tsx` (Principal)
- `src/routes/_authenticated.pedidos-venda.novo.tsx` (Fluxo do Wizard)
