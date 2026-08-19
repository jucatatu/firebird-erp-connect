# SPRINT ORDERS UX — VENDEDOR NA LISTAGEM + CATÁLOGO EM CARDS POR TIPO

# PLANO COMPLETO CONSOLIDADO

&nbsp;

## OBJETIVO

&nbsp;

Implementar dois ajustes de UX no módulo de Pedidos:

&nbsp;

1. Exibir o Vendedor ERP responsável na listagem de pedidos.

2. Reorganizar os produtos do Novo Pedido em CARDS PRINCIPAIS

   por categoria, contendo internamente os cards individuais dos produtos.

&nbsp;

Categorias:

&nbsp;

- CHOPP

- GROWLER

- GARRAFAS

- OUTROS, somente quando existirem itens não classificados

&nbsp;

IMPORTANTE:

&nbsp;

NÃO haverá busca de produtos.

&nbsp;

A navegação será exclusivamente visual pelos cards principais.

&nbsp;

Estado inicial:

&nbsp;

CHOPP

→ EXPANDIDO.

&nbsp;

GROWLER

→ RECOLHIDO.

&nbsp;

GARRAFAS

→ RECOLHIDO.

&nbsp;

OUTROS

→ RECOLHIDO.

&nbsp;

NÃO alterar Firebird.

NÃO alterar backend Node.

NÃO alterar criação/edição de pedido.

NÃO alterar DATA_PREV_ENTREGA.

NÃO alterar ENTREGAR.

NÃO alterar Sellers backend.

NÃO alterar Admin Users.

NÃO alterar Supabase schema.

NÃO alterar Mapa.

NÃO usar Fast Visual Edit.

&nbsp;

==================================================

1. VENDEDOR NA LISTAGEM

==================================================

&nbsp;

Arquivo principal:

&nbsp;

src/routes/_authenticated.pedidos-venda.index.tsx

&nbsp;

A fonte do vendedor comercial é:

&nbsp;

payload.sellerId

&nbsp;

NÃO utilizar:

&nbsp;

created_by

&nbsp;

para identificar vendedor ERP.

&nbsp;

created_by representa o usuário do aplicativo.

&nbsp;

==================================================

2. CARREGAMENTO DOS SELLERS

==================================================

&nbsp;

Reutilizar:

&nbsp;

src/lib/erp-sellers.functions.ts

&nbsp;

Executar UMA consulta por página:

&nbsp;

searchErpSellers({

  q: "",

  limit: 100

})

&nbsp;

Construir:

&nbsp;

Map<number, ErpSeller>

&nbsp;

Não executar uma chamada por pedido.

&nbsp;

Evitar N+1.

&nbsp;

==================================================

3. FALHA DO SELLERS NÃO BLOQUEIA PEDIDOS

==================================================

&nbsp;

A listagem de pedidos deve continuar funcionando mesmo se:

&nbsp;

/api/v1/sellers

&nbsp;

estiver indisponível.

&nbsp;

Se sellerId existir e nome não puder ser resolvido:

&nbsp;

mostrar discretamente:

&nbsp;

Vendedor #15

&nbsp;

ou equivalente.

&nbsp;

Se o draft não possuir sellerId:

&nbsp;

mostrar:

&nbsp;

—

&nbsp;

Não inventar vendedor.

&nbsp;

==================================================

4. VISUAL MOBILE DO VENDEDOR

==================================================

&nbsp;

No card mobile utilizar composição compacta.

&nbsp;

Preferência:

&nbsp;

GROTT • MARCEL • 18/08/2026

&nbsp;

Preservar:

&nbsp;

cliente

ERP / APP

status

produtos

equipamentos

logística.

&nbsp;

Não criar uma nova seção grande somente para vendedor.

&nbsp;

==================================================

5. VISUAL DESKTOP DO VENDEDOR

==================================================

&nbsp;

Na tabela desktop utilizar preferencialmente a célula Empresa.

&nbsp;

Exemplo:

&nbsp;

GROTT

MARCEL

&nbsp;

ou:

&nbsp;

GROTT • MARCEL

&nbsp;

Não criar coluna larga desnecessária.

&nbsp;

==================================================

6. AUTORIZAÇÃO NÃO MUDA

==================================================

&nbsp;

Preservar integralmente:

&nbsp;

mineOnly

created_by

roles

RLS

company access.

&nbsp;

Mostrar Seller é somente apresentação.

&nbsp;

==================================================

7. REMOVER TOTALMENTE A BUSCA DE PRODUTOS

==================================================

&nbsp;

Na etapa:

&nbsp;

1. Produtos

&nbsp;

REMOVER:

&nbsp;

"Filtrar produtos..."

&nbsp;

REMOVER:

&nbsp;

input

lupa

filtro textual.

&nbsp;

NÃO substituir por outra busca.

&nbsp;

Os produtos serão navegados exclusivamente pelos cards de categorias.

&nbsp;

==================================================

8. NÃO CRIAR NOVA CONSULTA DE PRODUTOS

==================================================

&nbsp;

IMPORTANTE:

&nbsp;

O Wizard já possui uma coleção de produtos carregada.

&nbsp;

O agrupamento deve trabalhar sobre ESSA coleção existente.

&nbsp;

NÃO adicionar um segundo useQuery de Products somente para agrupamento.

&nbsp;

Não duplicar requests ao ERP.

&nbsp;

==================================================

9. CONTRATO ErpProduct

==================================================

&nbsp;

A API Products já retorna:

&nbsp;

group: {

  id,

  description

}

&nbsp;

Atualizar apenas o tipo frontend ErpProduct, se necessário:

&nbsp;

group?: {

  id: number | null

  description: string | null

} | null

&nbsp;

Não alterar endpoint Node.

&nbsp;

Não alterar SQL.

&nbsp;

==================================================

10. CLASSIFICADOR

==================================================

&nbsp;

Criar:

&nbsp;

src/utils/order-product-group.ts

&nbsp;

Tipo:

&nbsp;

export type OrderProductGroup =

  | "CHOPP"

  | "GROWLER"

  | "GARRAFA"

  | "OUTROS"

&nbsp;

Função:

&nbsp;

classifyOrderProduct(product)

&nbsp;

Essa classificação é exclusivamente visual.

&nbsp;

Não persistir categoria.

&nbsp;

==================================================

11. FONTE DA CLASSIFICAÇÃO

==================================================

&nbsp;

Prioridade da informação:

&nbsp;

1. product.group?.description

2. product.description como fallback

&nbsp;

Normalizar texto:

&nbsp;

uppercase

remover acentos

trim.

&nbsp;

==================================================

12. PRIORIDADE DAS CATEGORIAS

==================================================

&nbsp;

Prioridade obrigatória:

&nbsp;

1. GROWLER

2. GARRAFA

3. CHOPP

4. OUTROS

&nbsp;

A embalagem tem prioridade sobre a palavra CHOPP.

&nbsp;

Exemplo real obrigatório:

&nbsp;

"CHOPP DE VINHO GROWLER PET 1,5L"

&nbsp;

→ GROWLER

&nbsp;

NUNCA CHOPP.

&nbsp;

==================================================

13. REGRAS

==================================================

&nbsp;

Se grupo/descrição contiver:

&nbsp;

GROWLER

→ GROWLER

&nbsp;

senão, se contiver:

&nbsp;

GARRAFA

→ GARRAFA

&nbsp;

senão, se contiver:

&nbsp;

CHOPP

ou

CHOPE

→ CHOPP

&nbsp;

senão:

&nbsp;

→ OUTROS.

&nbsp;

Não classificar apenas por volume.

&nbsp;

==================================================

14. PRODUTO NÃO PODE SER DUPLICADO

==================================================

&nbsp;

Cada produto pertence a exatamente UMA categoria.

&nbsp;

Um mesmo produto nunca pode aparecer:

&nbsp;

em CHOPP

e GROWLER

&nbsp;

ou qualquer outro grupo simultaneamente.

&nbsp;

==================================================

15. CARD PRINCIPAL CHOPP

==================================================

&nbsp;

Criar um CARD PRINCIPAL:

&nbsp;

CHOPP

&nbsp;

Estado inicial:

&nbsp;

ABERTO.

&nbsp;

Dentro dele renderizar os cards atuais de produtos classificados como CHOPP.

&nbsp;

Visual:

&nbsp;

┌─────────────────────────────┐

│ CHOPP                   ▲   │

│ 6 produtos                   │

│                              │

│ [CARD CHOPP PILSEN]          │

│                              │

│ [CARD AMERICAN IPA]          │

└─────────────────────────────┘

&nbsp;

Os produtos precisam parecer pertencentes ao card principal.

&nbsp;

==================================================

16. CARD PRINCIPAL GROWLER

==================================================

&nbsp;

Estado inicial:

&nbsp;

FECHADO.

&nbsp;

Inicialmente mostrar apenas:

&nbsp;

┌─────────────────────────────┐

│ GROWLER                 ▼   │

│ 3 produtos                   │

└─────────────────────────────┘

&nbsp;

Ao tocar:

&nbsp;

expandir DENTRO do próprio card.

&nbsp;

Mostrar os cards individuais Growler.

&nbsp;

==================================================

17. CARD PRINCIPAL GARRAFAS

==================================================

&nbsp;

Mesmo comportamento do Growler.

&nbsp;

Estado inicial:

&nbsp;

FECHADO.

&nbsp;

Ao expandir:

&nbsp;

mostrar seus cards individuais dentro do card principal.

&nbsp;

==================================================

18. CARD OUTROS

==================================================

&nbsp;

Somente renderizar se houver produtos classificados como OUTROS.

&nbsp;

Estado inicial:

&nbsp;

FECHADO.

&nbsp;

Nunca esconder produtos desconhecidos.

&nbsp;

==================================================

19. CATEGORIAS VAZIAS

==================================================

&nbsp;

Se uma categoria não tiver produtos:

&nbsp;

NÃO renderizar seu card principal.

&nbsp;

Exemplo:

&nbsp;

zero Garrafas

→ nenhuma seção GARRAFAS.

&nbsp;

==================================================

20. EXPANSÃO INDEPENDENTE

==================================================

&nbsp;

Pode haver mais de uma categoria aberta simultaneamente.

&nbsp;

Abrir GROWLER não deve obrigar CHOPP a fechar.

&nbsp;

Isso não deve funcionar como accordion exclusivo.

&nbsp;

==================================================

21. CARD DE PRODUTO INTERNO

==================================================

&nbsp;

Preservar o card atual de produto e todas as funções existentes:

&nbsp;

nome

preço

PREÇO PADRÃO

edição de preço

10L / 20L / 30L / 50L

quantidade

unidade

subtotal

Adicionar

Remover.

&nbsp;

Não simplificar funcionalidade.

&nbsp;

==================================================

22. ESTADO DOS PRODUTOS

==================================================

&nbsp;

Abrir ou fechar categoria NÃO pode alterar:

&nbsp;

quantidade

preço

produto adicionado

subtotal

equipamentos relacionados

estado do pedido.

&nbsp;

Expand/collapse é apenas visual.

&nbsp;

==================================================

23. ORDEM DAS CATEGORIAS

==================================================

&nbsp;

Ordem fixa:

&nbsp;

1. CHOPP

2. GROWLER

3. GARRAFAS

4. OUTROS.

&nbsp;

==================================================

24. ORDEM DOS PRODUTOS

==================================================

&nbsp;

Dentro de cada grupo:

&nbsp;

preservar a ordem atual recebida pelo Wizard/API.

&nbsp;

Não ordenar novamente por nome.

&nbsp;

Preservar sort_order/origem quando aplicável.

&nbsp;

==================================================

25. CONTADOR

==================================================

&nbsp;

No cabeçalho do card principal mostrar a quantidade.

&nbsp;

Exemplo:

&nbsp;

CHOPP

6 produtos

&nbsp;

GROWLER

3 produtos

&nbsp;

Pode opcionalmente mostrar:

&nbsp;

1 selecionado

&nbsp;

quando houver item daquele grupo já adicionado,

desde que isso não aumente muito o escopo.

&nbsp;

==================================================

26. RESPONSIVIDADE

==================================================

&nbsp;

Priorizar mobile.

&nbsp;

Experiência esperada:

&nbsp;

abrir etapa Produtos

&nbsp;

→ CHOPP já expandido

&nbsp;

→ selecionar produto

&nbsp;

→ se precisar Growler:

tocar em GROWLER

&nbsp;

→ produtos aparecem dentro do card

&nbsp;

→ selecionar

&nbsp;

→ continuar.

&nbsp;

Evitar lista gigante vertical.

&nbsp;

==================================================

27. DESKTOP

==================================================

&nbsp;

Usar a mesma arquitetura.

&nbsp;

Não criar uma implementação paralela.

&nbsp;

Apenas adaptar largura/espaçamento responsivamente.

&nbsp;

==================================================

28. TESTES DO CLASSIFICADOR

==================================================

&nbsp;

Criar:

&nbsp;

src/utils/__tests__/order-product-group.test.ts

&nbsp;

Testar:

&nbsp;

"CHOPP PILSEN"

→ CHOPP

&nbsp;

"CHOPP AMERICAN IPA"

→ CHOPP

&nbsp;

"CHOPP DE VINHO GROWLER PET 1,5L"

→ GROWLER

&nbsp;

"GROWLER PET 1,5L"

→ GROWLER

&nbsp;

"GARRAFA PILSEN"

→ GARRAFA

&nbsp;

produto desconhecido

→ OUTROS.

&nbsp;

==================================================

29. TESTES DE PRIORIDADE

==================================================

&nbsp;

Obrigatórios:

&nbsp;

CHOPP + GROWLER

→ GROWLER

&nbsp;

CHOPP + GARRAFA

→ GARRAFA.

&nbsp;

==================================================

30. TESTES DE AGRUPAMENTO

==================================================

&nbsp;

Garantir:

&nbsp;

- cada produto aparece uma única vez;

- grupo vazio não aparece;

- todos os produtos continuam presentes em algum grupo;

- nenhum produto é perdido;

- CHOPP é aberto inicialmente;

- demais são fechados inicialmente.

&nbsp;

==================================================

31. TESTES DO SELLER

==================================================

&nbsp;

Cobrir:

&nbsp;

payload.sellerId = 15

→ sellerId = 15.

&nbsp;

sellerMap:

&nbsp;

15 → MARCEL

&nbsp;

→ nome exibido MARCEL.

&nbsp;

Draft sem sellerId:

→ —.

&nbsp;

Erro no endpoint Sellers:

→ listagem continua funcionando.

&nbsp;

==================================================

32. NÃO ALTERAR HORÁRIO

==================================================

&nbsp;

Zero alterações em:

&nbsp;

deliveryTimeDraft

normalizeTimeInput

finalizeTimeInput

deliveryAt

DATA_PREV_ENTREGA

toDateCivil.

&nbsp;

==================================================

33. NÃO ALTERAR PEDIDO

==================================================

&nbsp;

Não alterar:

&nbsp;

CreateOrderInput

sellerId

items

equipments

payment

deliveryAt

returnAt

deliver

companyId

status

idempotência.

&nbsp;

==================================================

34. BACKEND

==================================================

&nbsp;

Zero diff esperado em:

&nbsp;

erp-api/src/

&nbsp;

Não criar endpoint.

&nbsp;

Não modificar Products.

&nbsp;

Não modificar Sellers.

&nbsp;

Não modificar Orders.

&nbsp;

==================================================

35. SUPABASE

==================================================

&nbsp;

Zero migration.

&nbsp;

Zero alteração de schema.

&nbsp;

Zero alteração de RLS.

&nbsp;

==================================================

36. ARQUIVOS ESPERADOS

==================================================

&nbsp;

Preferencialmente:

&nbsp;

src/routes/_authenticated.pedidos-venda.index.tsx

src/routes/_authenticated.pedidos-venda.novo.tsx

src/lib/erp-orders.functions.ts

src/utils/order-product-group.ts

src/utils/__tests__/order-product-group.test.ts

&nbsp;

e testes diretamente relacionados.

&nbsp;

Reutilizar:

&nbsp;

src/lib/erp-sellers.functions.ts

&nbsp;

sem alterar, se possível.

&nbsp;

==================================================

37. CRITÉRIOS DE ACEITE

==================================================

&nbsp;

[ ] vendedor mobile

[ ] vendedor desktop

[ ] seller vem de payload.sellerId

[ ] sem N+1

[ ] falha Sellers não derruba pedidos

&nbsp;

[ ] campo de busca removido

[ ] nenhuma busca substituta criada

[ ] produtos existentes reutilizados

[ ] nenhuma query duplicada de Products

&nbsp;

[ ] CHOPP é card principal

[ ] CHOPP aberto por padrão

[ ] produtos dentro do card CHOPP

&nbsp;

[ ] GROWLER é card principal

[ ] GROWLER fechado por padrão

[ ] produtos aparecem dentro ao expandir

&nbsp;

[ ] GARRAFAS fechado por padrão

[ ] OUTROS fechado por padrão

&nbsp;

[ ] grupos vazios não aparecem

[ ] produtos não duplicam

[ ] nenhum produto é perdido

&nbsp;

[ ] Growler > Chopp

[ ] Garrafa > Chopp

&nbsp;

[ ] cards atuais preservados

[ ] quantidades preservadas

[ ] preços preservados

[ ] subtotais preservados

[ ] equipamentos preservados

&nbsp;

[ ] Node zero diff

[ ] Supabase zero diff

[ ] Firebird zero alteração

[ ] horário zero alteração

[ ] Sellers backend zero alteração

&nbsp;

[ ] testes persistidos no Git

[ ] typecheck passa

[ ] build passa

[ ] NÃO usar Fast Visual Edit

&nbsp;

==================================================

38. STATUS FINAL

==================================================

&nbsp;

Após implementação:

&nbsp;

ORDERS UX — AGUARDANDO REVISÃO GIT

&nbsp;

NÃO declarar homologado.

&nbsp;

Depois:

&nbsp;

PARAR.

&nbsp;

NÃO iniciar Mapa.

NÃO iniciar Sprint 8.9.43.2.

&nbsp;

Aguardar publicação e revisão Git.