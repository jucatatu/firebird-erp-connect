# SPRINT 8.9.42.2 — NOVO CLIENTE EM TELA DEDICADA + RAIO RÍGIDO DE 50 KM

## OBJETIVO
Refinar o fluxo de cadastro de Novo Cliente ERP. Mover o formulário para uma interface dedicada (Sheet/Dialog) e implementar a regra rígida de 50 km de atendimento a partir de Jaraguá do Sul/SC, validando geograficamente todos os endereços (mesmo os manuais).

## DESIGN & UI
- **Interface Dedicada**: O formulário sai do card inline e abre em um `Sheet` (lateral no desktop, full-screen no mobile).
- **Mobile First**: No mobile, ocupará a tela inteira com scroll interno, bloqueando o scroll da página de fundo.
- **Cabeçalho**: Título "Novo Cliente ERP" com subtexto informativo e botão de fechar/cancelar.
- **Fluxo Pós-Cadastro**: Mantém a tela de confirmação visual antes de iniciar o pedido, permitindo o uso da action `newOrderFromClient`.

## REGRAS DE NEGÓCIO (BACKEND / SERVER FUNCTIONS)
- **Constantes Geográficas**:
  - Centro: `-26.48, -49.07` (Jaraguá do Sul/SC)
  - Raio: `50.000` metros.
- **Validação Server-Side**: A `createErpClient` receberá coordenadas e validará o raio via Haversine antes de qualquer chamada ao ERP Firebird.
- **Erro Específico**: Retorno `ADDRESS_OUTSIDE_SERVICE_AREA` se fora do raio.

## IMPLEMENTAÇÃO TÉCNICA (FRONTEND)
- **Google Places**: Substituir `locationBias` por `locationRestriction` no autocomplete.
- **Validação Geográfica Híbrida**:
  - **Autocomplete**: Captura `location` no `fetchFields`.
  - **Manual/Edição**: Utiliza `google.maps.Geocoder` para validar o endereço montado (Rua + Número + Bairro + Cidade + UF + CEP) antes do submit.
- **Estado de Validação**: Impedir submit enquanto o endereço não for validado e estiver dentro do raio.
- **UF Estrito**: Garantir que a UF enviada tenha apenas 2 caracteres (SC, PR, etc).

## ARQUIVOS AFETADOS
- `src/components/client/create-client-form.tsx`: Overhaul visual (remoção de estilos inline redundantes) e lógica de geocodificação/restrição.
- `src/routes/_authenticated.pedidos-venda.novo.tsx`: Mover `CreateClientForm` para dentro de um `Sheet` e ajustar os gatilhos de abertura.
- `src/lib/erp-orders.functions.ts`: Adicionar validação de raio na server function `createErpClient`.
- `src/utils/geo-utils.ts` (Novo): Helper para cálculo Haversine e constantes.

## NÃO SERÁ ALTERADO
- ERP Firebird (procedures, mappers, etc).
- Fluxo de Entrega existente (a regra de 50km é exclusiva para *novos cadastros* nesta sprint).
- Supabase Schema.
