# Plano de Hotfix: Abertura Novo Cliente ERP

Este plano visa corrigir a abertura da tela de cadastro de novo cliente na página de novo pedido, garantindo que o componente esteja acessível em todas as etapas e removendo a duplicidade de botões.

## Ações imediatas

### 1. Correção estrutural (Hotfix)
- **Localizar o `Sheet` de Novo Cliente**: Identificar o bloco `<Sheet open={showCreateClient} ...>` que está atualmente aninhado dentro da condicional `step === "items"`.
- **Mover o `Sheet` para o nível global**: Reposicionar o componente para o final do JSX principal da `NewOrderPage`, garantindo que ele permaneça montado independentemente da etapa do Wizard (`step`).
- **Remover botão duplicado**: Excluir o botão "Novo Cliente" presente no cabeçalho da seção "Identificação" na etapa `client`.
- **Preservar o botão principal**: Manter apenas o botão "+ Novo Cliente" localizado ao lado do rótulo "Buscar cliente".

### 2. Validação de Comportamento
- Garantir que o botão continue desabilitado quando nenhuma empresa estiver selecionada.
- Verificar se a abertura do `Sheet` não altera a etapa atual (`client`) e permite o preenchimento do formulário em tela cheia (mobile).
- Validar se o cancelamento ou fechamento do `Sheet` retorna o usuário à busca de clientes sem perdas de estado.

## Detalhes técnicos

### Arquivos afetados:
- `src/routes/_authenticated.pedidos-venda.novo.tsx`: Refatoração do JSX para ajuste de escopo do `Sheet` e remoção de botão duplicado.

### Invariantes preservadas:
- Nenhuma alteração em `create-client-form.tsx`.
- Regras de geofencing (50km) e validação Haversine permanecem intactas.
- Lógica de sucesso e integração com `newOrderFromClient` mantida sem alterações.
