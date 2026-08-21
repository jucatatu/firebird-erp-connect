# HOTFIX ORDERS DELIVERY.1.1 — FECHAR VALIDAÇÃO DE ENDEREÇO E HORÁRIO CIVIL

Este plano visa consolidar a validação de endereço de entrega customizado e garantir a integridade do horário civil em pedidos de venda, resolvendo falhas de fallback e normalização.

## User Review Required

> [!IMPORTANT]
> O plano move a validação de endereço do `validateClient` para um helper dedicado no `orders.service.js`, permitindo pedidos com endereço customizado mesmo que o cadastro do cliente esteja incompleto.

- Nenhuma mudança nas procedures Firebird ou migrações de banco de dados.
- Reversão total da alteração em `src/routes/auditoria-produtos.tsx`.

## Proposed Changes

### Backend (erp-api)

#### [Orders Service](erp-api/src/modules/orders/orders.service.js)
- Criar helper `resolveDeliveryAddress(payload, client)` para centralizar a lógica de fallback.
- Se `deliveryAddressSource === 'custom'`, validar obrigatoriedade de campos (rua, número, bairro, cidade, UF, CEP) e lançar `DELIVERY_ADDRESS_INCOMPLETE` (422) se incompleto. Proibir fallback automático para o endereço do cliente.
- Se `source === 'client'`, usar endereço do cadastro e validar integridade.
- Refatorar `validateClient` para verificar apenas existência e estado do cliente, removendo a trava de endereço.
- Aplicar a mesma lógica em `createOrderTransactional` e `updateOrder`.

#### [Orders Mapper](erp-api/src/modules/orders/orders.mapper.js)
- Alterar `buildCompleteProcParams` para receber o endereço já resolvido.
- Implementar normalização rigorosa: CEP apenas dígitos (max 8) e trim em todas as strings de endereço.
- Garantir que `toDateCivil` processe strings ISO locais preservando o horário (ex: 09:37) sem resets de timezone.

#### [Orders Validator](erp-api/src/modules/orders/orders.validator.js)
- Manter `bodySchema` estrito, permitindo `deliveryAddress` como opcional no Zod para compatibilidade, delegando a validação semântica ao Service.

#### [Tests](erp-api/tests/hotfix-delivery-address.test.js)
- Atualizar suíte de testes para cobrir:
    - Custom completo vs Custom inválido (erro 422).
    - Cadastro cliente incompleto + Custom completo (permitido).
    - Preservação de horário civil em `deliveryAt` e `returnAt`.

### Frontend

#### [Orders Functions](src/lib/erp-orders.functions.ts)
- Garantir que o payload enviado contenha `deliveryAddressSource` e `deliveryAddress` sem truncar horários.

#### [Auditoria Produtos](src/routes/auditoria-produtos.tsx)
- Reverter o conteúdo do arquivo para o estado original (instrução "Parar").

## Technical Details

- **Normalização de CEP**: `addr.zip.replace(/\D/g, '').slice(0, 8)`.
- **Validação de Endereço Custom**:
    ```javascript
    const required = ['street', 'number', 'neighborhood', 'city', 'state', 'postalCode'];
    const missing = required.filter(f => !payload.deliveryAddress[f]?.trim());
    if (missing.length > 0) throw new AppError(...);
    ```
- **Horário Civil**: Manter `new Date(year, month-1, day, hour, minute)` para instanciar datas locais sem influência de UTC/Timezone do servidor.

## Validation Plan

1. Executar testes de unidade do backend: `node erp-api/tests/hotfix-delivery-address.test.js`.
2. Validar mapeamento com diferentes timezones simulados.
3. Verificar build e typecheck do frontend.
4. Conferir se `auditoria-produtos.tsx` foi restaurado.
