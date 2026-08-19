# SPRINT CATALOG UX — ORDENAÇÃO VISUAL POR DRAG-AND-DROP

# PLANO COMPLETO CONSOLIDADO E CORRETIVO

&nbsp;

## OBJETIVO

&nbsp;

Melhorar a administração do Catálogo de Pedidos permitindo ordenar

Produtos e Equipamentos visualmente por drag-and-drop.

&nbsp;

REGRA DEFINITIVA:

&nbsp;

- entrar no modo "Ordenar";

- mover itens livremente;

- nenhuma escrita ocorre enquanto arrasta;

- toda a movimentação fica somente no frontend;

- somente o botão "Salvar ordem" persiste;

- "Cancelar" descarta absolutamente todas as alterações locais.

&nbsp;

Também eliminar a necessidade de preencher manualmente o campo "Ordem"

no cadastro individual.

&nbsp;

NÃO alterar Firebird.

NÃO alterar ERP Node.

NÃO alterar Orders backend.

NÃO alterar Sellers.

NÃO alterar Admin Users.

NÃO alterar Mapa.

NÃO usar Fast Visual Edit.

&nbsp;

==================================================

1. ATENÇÃO — MIGRATIONS JÁ CRIADAS DURANTE O PLANO

==================================================

&nbsp;

Já existem no main:

&nbsp;

supabase/migrations/

20260819113803_0b3ae01d-4c69-4066-b026-e60212a0eaae.sql

&nbsp;

e:

&nbsp;

20260819113830_271f2a56-f25e-4a49-afe2-ff42ace223d7.sql

&nbsp;

NÃO apagar.

NÃO reescrever migrations já existentes.

&nbsp;

A primeira criou:

&nbsp;

public.admin_reorder_catalog_items

&nbsp;

Porém ela NÃO é a versão final segura.

&nbsp;

Criar NOVA migration corretiva com timestamp posterior

usando CREATE OR REPLACE FUNCTION.

&nbsp;

==================================================

2. CORRIGIR VALIDAÇÃO DE DUPLICADOS

==================================================

&nbsp;

A implementação atual contém lógica equivalente a:

&nbsp;

IF (

  SELECT count(*)

  FROM (...)

  GROUP BY id

  HAVING count(*) > 1

) THEN

&nbsp;

NÃO manter essa construção.

&nbsp;

Utilizar condição booleana válida:

&nbsp;

IF EXISTS (

  SELECT id

  FROM unnest(_ordered_ids) AS id

  GROUP BY id

  HAVING count(*) > 1

) THEN

  RAISE EXCEPTION ...

END IF;

&nbsp;

Adicionar teste específico para IDs duplicados.

&nbsp;

==================================================

3. CONTROLE REAL DE CONCORRÊNCIA

==================================================

&nbsp;

O campo:

&nbsp;

order_catalog_settings.version

&nbsp;

já existe e deve ser utilizado de verdade.

&nbsp;

Não basta:

&nbsp;

version = version + 1.

&nbsp;

A RPC deve receber também as versões que o frontend carregou

antes do usuário entrar no modo Ordenar.

&nbsp;

Contrato recomendado:

&nbsp;

admin_reorder_catalog_items(

  _item_type,

  _ordered_ids,

  _expected_versions

)

&nbsp;

Onde:

&nbsp;

_ordered_ids uuid[]

_expected_versions integer[]

&nbsp;

Os arrays devem possuir exatamente o mesmo tamanho.

&nbsp;

Cada posição corresponde ao mesmo item.

&nbsp;

Exemplo:

&nbsp;

IDs:

[A, B, C]

&nbsp;

Versions:

[4, 7, 2]

&nbsp;

Antes de qualquer UPDATE:

&nbsp;

confirmar que:

&nbsp;

A.version = 4

B.version = 7

C.version = 2

&nbsp;

Se qualquer versão for diferente:

&nbsp;

RAISE EXCEPTION:

&nbsp;

catalog_reorder_conflict

&nbsp;

E ZERO item deve ser atualizado.

&nbsp;

==================================================

4. VALIDAR SNAPSHOT COMPLETO

==================================================

&nbsp;

A lista enviada para reordenar deve representar TODOS os itens

configurados daquele item_type.

&nbsp;

Para:

&nbsp;

product

&nbsp;

a RPC deve verificar que o conjunto de IDs recebido corresponde

ao conjunto atual de:

&nbsp;

order_catalog_settings

WHERE item_type = 'product'

&nbsp;

Para:

&nbsp;

equipment

&nbsp;

mesma regra.

&nbsp;

Isso evita que um item criado por outro administrador enquanto

a tela estava aberta seja silenciosamente ignorado.

&nbsp;

Se houver item faltando ou item adicional:

&nbsp;

catalog_reorder_conflict

&nbsp;

==================================================

5. VALIDAÇÕES DA RPC

==================================================

&nbsp;

Validar ANTES de atualizar:

&nbsp;

- auth.uid() existente;

- usuário com role administrativa conforme regra atual do Catálogo;

- item_type válido;

- lista não nula;

- IDs sem duplicidade;

- todos os IDs existem;

- todos pertencem ao item_type informado;

- número de IDs corresponde ao conjunto atual;

- versões correspondem ao snapshot atual;

- arrays possuem mesmo tamanho.

&nbsp;

Somente depois realizar UPDATE.

&nbsp;

==================================================

6. SEGURANÇA

==================================================

&nbsp;

Preservar:

&nbsp;

SECURITY DEFINER

SET search_path = public

&nbsp;

Preservar restrição:

&nbsp;

REVOKE EXECUTE FROM PUBLIC

REVOKE EXECUTE FROM anon

&nbsp;

Permitir somente os roles já previstos pelo módulo.

&nbsp;

NÃO criar GRANT genérico de UPDATE em:

&nbsp;

order_catalog_settings.

&nbsp;

A tela atual ainda utiliza a regra administrativa legada.

&nbsp;

NÃO antecipar nesta sprint a aplicação progressiva da nova árvore

de permissões.

&nbsp;

A integração admin.catalog/edit fica para a sprint específica

de permissões.

&nbsp;

==================================================

7. ATOMICIDADE

==================================================

&nbsp;

A RPC é uma única transação PostgreSQL.

&nbsp;

Regra:

&nbsp;

ou TODOS os sort_order são atualizados,

&nbsp;

ou NENHUM.

&nbsp;

Não realizar uma chamada RPC para cada item.

&nbsp;

Não realizar vários UPDATE separados a partir do browser.

&nbsp;

==================================================

8. NOVO sort_order

==================================================

&nbsp;

Ao salvar:

&nbsp;

posição 1 → sort_order 10

posição 2 → sort_order 20

posição 3 → sort_order 30

posição 4 → sort_order 40

&nbsp;

e assim por diante.

&nbsp;

Todos os itens devem receber valores únicos e crescentes

dentro do item_type.

&nbsp;

Incrementar:

&nbsp;

version = version + 1

&nbsp;

e atualizar:

&nbsp;

updated_at = now().

&nbsp;

==================================================

9. UMA ÚNICA PERSISTÊNCIA

==================================================

&nbsp;

Durante:

&nbsp;

drag start

drag over

drag move

drag end

seta para cima

seta para baixo

&nbsp;

NÃO chamar Supabase.

&nbsp;

Somente:

&nbsp;

Salvar ordem

&nbsp;

pode chamar:

&nbsp;

admin_reorder_catalog_items.

&nbsp;

Uma operação final por salvamento.

&nbsp;

==================================================

10. DND-KIT

==================================================

&nbsp;

Adicionar somente:

&nbsp;

@dnd-kit/core

@dnd-kit/sortable

@dnd-kit/utilities

&nbsp;

O projeto ainda não possui biblioteca drag-and-drop.

&nbsp;

Não usar HTML5 drag puro.

&nbsp;

O recurso deve funcionar corretamente por touch no Android.

&nbsp;

==================================================

11. BOTÃO ORDENAR

==================================================

&nbsp;

Em:

&nbsp;

src/routes/_authenticated.settings.catalogo.tsx

&nbsp;

Adicionar ao bloco de itens configurados:

&nbsp;

[ Ordenar ]

&nbsp;

Não tornar a tela permanentemente draggable.

&nbsp;

==================================================

12. MODO NORMAL

==================================================

&nbsp;

Preservar cards atuais:

&nbsp;

nome

ERP ID

Disponível

empresa

logística.

&nbsp;

Cards continuam clicáveis para editar configuração.

&nbsp;

Não adicionar drag handle no modo normal.

&nbsp;

==================================================

13. MODO ORDENAR

==================================================

&nbsp;

Ao tocar:

&nbsp;

Ordenar

&nbsp;

criar snapshot local dos itens:

&nbsp;

originalOrder

&nbsp;

e:

&nbsp;

localOrder

&nbsp;

A partir daí:

&nbsp;

somente localOrder é alterado.

&nbsp;

Exemplo:

&nbsp;

☰  1  CHOPP PILSEN

☰  2  CHOPP AMERICAN IPA

☰  3  WEIZEN

&nbsp;

Não abrir dialog de edição ao tocar no item nesse modo.

&nbsp;

==================================================

14. HANDLE

==================================================

&nbsp;

O drag deve iniciar SOMENTE pelo handle:

&nbsp;

☰

&nbsp;

ou ícone equivalente GripVertical.

&nbsp;

Não tornar o card inteiro draggable.

&nbsp;

Motivo:

&nbsp;

preservar scroll vertical natural no celular.

&nbsp;

==================================================

15. POSIÇÃO VISÍVEL

==================================================

&nbsp;

Mostrar posição atual:

&nbsp;

1

2

3...

&nbsp;

A posição muda imediatamente quando o item é movimentado.

&nbsp;

É somente informação visual.

&nbsp;

Não é gravada ainda.

&nbsp;

==================================================

16. PRODUTOS POR CATEGORIA

==================================================

&nbsp;

No modo Ordenar Produtos:

&nbsp;

mostrar os mesmos grupos conceituais usados no Novo Pedido:

&nbsp;

CHOPP

GROWLER

GARRAFAS

OUTROS

&nbsp;

Reutilizar:

&nbsp;

src/utils/order-product-group.ts

&nbsp;

NÃO duplicar classificador.

&nbsp;

Para CatalogSetting utilizar prioritariamente:

&nbsp;

erp_description_snapshot

&nbsp;

como descrição original do ERP para classificação.

&nbsp;

display_name não deve sozinho alterar a categoria operacional.

&nbsp;

==================================================

17. ORDEM DAS CATEGORIAS

==================================================

&nbsp;

Ordem fixa:

&nbsp;

1. CHOPP

2. GROWLER

3. GARRAFAS

4. OUTROS

&nbsp;

O usuário ordena os PRODUTOS dentro de cada grupo.

&nbsp;

Não permitir mover produto entre categorias.

&nbsp;

==================================================

18. SERIALIZAÇÃO FINAL DOS PRODUTOS

==================================================

&nbsp;

Apesar da interface estar agrupada por categoria,

ao salvar enviar UMA lista completa de produtos.

&nbsp;

Concatenar na ordem fixa:

&nbsp;

CHOPP ordenados

+

GROWLER ordenados

+

GARRAFAS ordenadas

+

OUTROS ordenados

&nbsp;

Exemplo:

&nbsp;

CHOPP:

A B C

&nbsp;

GROWLER:

D E

&nbsp;

Resultado enviado:

&nbsp;

[A, B, C, D, E]

&nbsp;

Assim sort_order permanece global e único dentro de:

&nbsp;

item_type = product.

&nbsp;

==================================================

19. EQUIPAMENTOS

==================================================

&nbsp;

Aplicar o mesmo modo:

&nbsp;

[ Ordenar ]

&nbsp;

porém equipamentos usam UMA única lista.

&nbsp;

Ordenar apenas equipamentos já configurados no catálogo.

&nbsp;

Não tentar arrastar resultados do ERP que ainda não possuem

order_catalog_settings.

&nbsp;

==================================================

20. NÃO CONFUNDIR CONFIGURADOS COM ERP

==================================================

&nbsp;

Produtos:

&nbsp;

modo Ordenar usa SOMENTE:

&nbsp;

settingsByKey / order_catalog_settings

item_type = product.

&nbsp;

Equipamentos:

&nbsp;

modo Ordenar usa SOMENTE:

&nbsp;

order_catalog_settings

item_type = equipment.

&nbsp;

Itens localizados na seção:

&nbsp;

"Buscar novo produto no ERP"

&nbsp;

ou equipamentos ainda não configurados

&nbsp;

NÃO participam do drag.

&nbsp;

==================================================

21. SALVAR ORDEM

==================================================

&nbsp;

Botões:

&nbsp;

[ Cancelar ] [ Salvar ordem ]

&nbsp;

No mobile preferencialmente sticky acima da bottom navigation.

&nbsp;

Salvar fica habilitado somente se:

&nbsp;

localOrder != originalOrder.

&nbsp;

Ao salvar:

&nbsp;

chamar RPC UMA vez.

&nbsp;

Enviar:

&nbsp;

item_type

ordered_ids

expected_versions.

&nbsp;

==================================================

22. CANCELAR

==================================================

&nbsp;

Ao tocar Cancelar:

&nbsp;

localOrder = originalOrder

&nbsp;

sair do modo Ordenar.

&nbsp;

Não chamar RPC.

Não fazer UPDATE.

Não invalidar artificialmente dados como se houvesse save.

&nbsp;

==================================================

23. FALHA AO SALVAR

==================================================

&nbsp;

Se RPC falhar:

&nbsp;

- permanecer no modo Ordenar;

- manter localOrder;

- mostrar erro;

- não restaurar automaticamente a ordem antiga;

- permitir tentar novamente;

- permitir Cancelar.

&nbsp;

Se erro for:

&nbsp;

catalog_reorder_conflict

&nbsp;

mostrar:

&nbsp;

"O catálogo foi alterado por outro administrador. Recarregue antes de salvar a nova ordem."

&nbsp;

==================================================

24. SUCESSO

==================================================

&nbsp;

Após sucesso:

&nbsp;

- invalidar ["catalog","settings"];

- recarregar catálogo;

- sair do modo Ordenar;

- atualizar originalOrder;

- toast:

&nbsp;

"Ordem atualizada com sucesso."

&nbsp;

==================================================

25. CAMPO ORDEM NO DIALOG

==================================================

&nbsp;

Hoje:

&nbsp;

CatalogItemDialog

&nbsp;

mantém:

&nbsp;

sortOrder

&nbsp;

e apresenta campo numérico:

&nbsp;

"Ordem".

&nbsp;

REMOVER esse campo editável da interface.

&nbsp;

O administrador não deve mais informar sort_order manualmente.

&nbsp;

==================================================

26. NOVO ITEM — ORDEM AUTOMÁTICA

==================================================

&nbsp;

Ao configurar um item novo pela primeira vez:

&nbsp;

atribuir automaticamente:

&nbsp;

MAX(sort_order do item_type) + 10

&nbsp;

Não usar:

&nbsp;

0

&nbsp;

como ordem padrão visível.

&nbsp;

Não exigir qualquer escolha do administrador.

&nbsp;

Implementar sem criar escrita extra no Firebird.

&nbsp;

Pode calcular o próximo sort_order a partir do catálogo carregado

antes do upsert.

&nbsp;

Preservar concorrência do upsert existente.

&nbsp;

==================================================

27. EDIÇÃO DE ITEM EXISTENTE

==================================================

&nbsp;

Ao editar item existente:

&nbsp;

preservar seu:

&nbsp;

sort_order atual.

&nbsp;

Alterar:

&nbsp;

empresa

disponibilidade

quantidade

logística

nome

&nbsp;

NÃO deve alterar sua posição na lista.

&nbsp;

Somente:

&nbsp;

Modo Ordenar → Salvar ordem

&nbsp;

muda sort_order de itens existentes.

&nbsp;

==================================================

28. HOOK

==================================================

&nbsp;

Adicionar em:

&nbsp;

src/hooks/use-catalog.ts

&nbsp;

hook:

&nbsp;

useReorderCatalog

&nbsp;

que chama exclusivamente:

&nbsp;

admin_reorder_catalog_items.

&nbsp;

onSuccess:

&nbsp;

invalidate catalog settings.

&nbsp;

Não executar múltiplas mutations por item.

&nbsp;

==================================================

29. COMPONENTE

==================================================

&nbsp;

Pode criar:

&nbsp;

src/components/settings/catalog-reorder-list.tsx

&nbsp;

Responsabilidades:

&nbsp;

- DndContext;

- SortableContext;

- drag handle;

- posição;

- visual mobile;

- setas acessíveis;

- emitir nova ordem LOCAL.

&nbsp;

Não deve conhecer Supabase.

&nbsp;

Não deve persistir.

&nbsp;

==================================================

30. HELPERS

==================================================

&nbsp;

Criar:

&nbsp;

src/utils/catalog-reorder-utils.ts

&nbsp;

Helpers puros, por exemplo:

&nbsp;

moveItem(...)

hasOrderChanged(...)

buildSortOrder(...)

flattenProductGroups(...)

&nbsp;

Cobrir por Vitest.

&nbsp;

==================================================

31. FALLBACK ↑ ↓

==================================================

&nbsp;

Além do handle de drag:

&nbsp;

oferecer opção acessível para:

&nbsp;

Mover para cima

Mover para baixo

&nbsp;

Pode ser botão/ação discreta.

&nbsp;

Também altera apenas localOrder.

&nbsp;

Nunca salva automaticamente.

&nbsp;

==================================================

32. NOVO PEDIDO

==================================================

&nbsp;

O Wizard já usa a coleção ordenada do catálogo.

&nbsp;

Preservar os cards-pai aprovados:

&nbsp;

CHOPP

GROWLER

GARRAFAS

OUTROS.

&nbsp;

Não modificar layout.

&nbsp;

Garantir apenas que dentro de cada grupo a ordem recebida

do catálogo seja preservada.

&nbsp;

Não fazer sort alfabético adicional.

&nbsp;

==================================================

33. TESTES RPC

==================================================

&nbsp;

Cobrir:

&nbsp;

- admin válido;

- não autenticado;

- não admin;

- IDs duplicados;

- ID inexistente;

- item_type incompatível;

- quantidade incompleta de IDs;

- expected_versions com tamanho diferente;

- conflito de version;

- sucesso.

&nbsp;

Obrigatório:

&nbsp;

em conflito nenhum sort_order é modificado.

&nbsp;

==================================================

34. TESTES FRONTEND

==================================================

&nbsp;

Cobrir:

&nbsp;

drag altera localOrder.

&nbsp;

Antes de Salvar:

RPC chamada 0 vezes.

&nbsp;

Após Salvar:

RPC chamada 1 vez.

&nbsp;

Cancelar:

RPC chamada 0 vezes.

&nbsp;

Falha:

modo ordenar permanece.

&nbsp;

Sucesso:

query invalidada.

&nbsp;

==================================================

35. TESTES HELPERS

==================================================

&nbsp;

A,B,C

mover C para início:

&nbsp;

C,A,B.

&nbsp;

A,B,C

mover A para final:

&nbsp;

B,C,A.

&nbsp;

Flatten:

&nbsp;

CHOPP [A,B]

GROWLER [C]

GARRAFA [D]

&nbsp;

→

&nbsp;

[A,B,C,D].

&nbsp;

sort_order:

&nbsp;

A=10

B=20

C=30

D=40.

&nbsp;

==================================================

36. TESTES NOVO ITEM

==================================================

&nbsp;

Itens existentes:

&nbsp;

10

20

30

&nbsp;

novo produto:

&nbsp;

→ 40.

&nbsp;

Editar item com:

&nbsp;

sort_order 20

&nbsp;

→ continua 20.

&nbsp;

==================================================

37. TYPES SUPABASE

==================================================

&nbsp;

Atualizar:

&nbsp;

src/integrations/supabase/types.ts

&nbsp;

com a assinatura REAL final da RPC:

&nbsp;

admin_reorder_catalog_items

&nbsp;

incluindo expected_versions.

&nbsp;

Não usar cast `as any` para chamar RPC.

&nbsp;

==================================================

38. NÃO ALTERAR PERMISSÕES GLOBAIS

==================================================

&nbsp;

Não iniciar aplicação de:

&nbsp;

admin.catalog/edit

&nbsp;

nesta sprint.

&nbsp;

Preservar modelo administrativo atual do Catálogo.

&nbsp;

A nova árvore será aplicada posteriormente na sprint progressiva

de permissões.

&nbsp;

==================================================

39. NÃO ALTERAR MÓDULOS EXTERNOS

==================================================

&nbsp;

ZERO diff funcional esperado em:

&nbsp;

erp-api/

Sellers

Admin Users

Mapa

Entregas

Recolhas

Orders backend.

&nbsp;

==================================================

40. CRITÉRIOS DE ACEITE

==================================================

&nbsp;

[ ] migration corretiva criada

[ ] migration antiga não editada

[ ] duplicate validation corrigida com EXISTS

[ ] version realmente validada

[ ] conflito impede qualquer update

[ ] snapshot completo validado

&nbsp;

[ ] botão Ordenar

[ ] drag mobile funciona

[ ] somente handle inicia drag

[ ] posição visível

[ ] nenhuma escrita durante drag

[ ] nenhuma escrita no dragEnd

[ ] Salvar faz uma única RPC

[ ] Cancelar faz zero RPC

&nbsp;

[ ] CHOPP ordenável internamente

[ ] GROWLER ordenável internamente

[ ] GARRAFAS ordenável internamente

[ ] OUTROS ordenável internamente

[ ] sem drag entre categorias

&nbsp;

[ ] equipamentos ordenáveis

[ ] somente itens configurados participam

&nbsp;

[ ] campo Ordem removido do dialog

[ ] novo item recebe max+10 automaticamente

[ ] editar item preserva sort_order

&nbsp;

[ ] Novo Pedido respeita ordem

[ ] cards do Novo Pedido intactos

&nbsp;

[ ] Node zero diff

[ ] Firebird zero escrita

[ ] Sellers zero diff

[ ] Mapa zero diff

&nbsp;

[ ] testes persistidos

[ ] typecheck passa

[ ] build passa

[ ] NÃO usar Fast Visual Edit

&nbsp;

==================================================

41. RELATÓRIO FINAL

==================================================

&nbsp;

Informar:

&nbsp;

1. migrations encontradas antes da execução;

2. migration corretiva criada;

3. correção da validação de duplicados;

4. implementação real de concorrência/version;

5. arquivos alterados;

6. dependências DnD adicionadas;

7. estado local;

8. confirmação ZERO escrita durante drag;

9. confirmação persistência somente em Salvar;

10. comportamento Cancelar;

11. comportamento conflito;

12. Produtos por categoria;

13. Equipamentos;

14. campo Ordem removido;

15. regra automática max+10;

16. integração com Novo Pedido;

17. testes RPC;

18. testes frontend;

19. typecheck;

20. build;

21. Node zero diff;

22. Firebird zero escrita.

&nbsp;

Depois:

&nbsp;

PARAR.

&nbsp;

NÃO iniciar Mapa.

NÃO iniciar Sprint 8.9.43.2.

&nbsp;

Aguardar publicação e revisão Git.