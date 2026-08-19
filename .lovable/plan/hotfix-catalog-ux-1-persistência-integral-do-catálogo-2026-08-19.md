# HOTFIX CATALOG UX.1 — PERSISTÊNCIA INTEGRAL DO CATÁLOGO

&nbsp;

## AUDITORIA CONFIRMADA

&nbsp;

Banco live:

&nbsp;

admin_reorder_catalog_items:

- versão 2 args

- versão 3 args

- ambas retornam void

&nbsp;

upsert_order_catalog_setting:

- versão 11 args

- versão 12 args

&nbsp;

Problemas reais homologados:

1. reorder não permanece após recarregar;

2. ativação/configuração de equipamento não permanece.

&nbsp;

Corrigir os dois caminhos de persistência.

&nbsp;

NÃO alterar Firebird, ERP Node, Orders, Sellers, Admin Users ou Mapa.

NÃO usar Fast Visual Edit.

&nbsp;

==================================================

1. MIGRATION CORRETIVA

==================================================

&nbsp;

Criar NOVA migration.

&nbsp;

NÃO editar migrations antigas.

&nbsp;

REORDER:

&nbsp;

- REVOKE + DROP da assinatura antiga de 2 args.

- REVOKE + DROP da atual de 3 args.

- recriar somente a versão canônica:

&nbsp;

admin_reorder_catalog_items(

  _item_type catalog_item_type,

  _ordered_ids uuid[],

  _expected_versions integer[]

)

&nbsp;

Retornar os registros persistidos, não void.

&nbsp;

Preferência:

&nbsp;

RETURNS SETOF order_catalog_settings

&nbsp;

com:

&nbsp;

RETURN QUERY

SELECT ...

WHERE item_type = _item_type

ORDER BY sort_order ASC, erp_item_id ASC;

&nbsp;

==================================================

2. VALIDAÇÕES DO REORDER

==================================================

&nbsp;

Antes de qualquer UPDATE validar:

&nbsp;

- auth.uid() existe;

- has_role(auth.uid(),'admin');

- arrays não nulos/vazios;

- tamanhos iguais;

- nenhum ID duplicado;

- todos os IDs existem;

- todos pertencem ao item_type;

- conjunto enviado é EXATAMENTE igual ao conjunto atual daquele item_type;

- expected_versions correspondem às versões atuais.

&nbsp;

Se faltar ou sobrar qualquer item:

&nbsp;

catalog_reorder_conflict.

&nbsp;

Não validar apenas COUNT.

&nbsp;

==================================================

3. LOCK E ATOMICIDADE

==================================================

&nbsp;

Antes da validação final de versões/update:

&nbsp;

bloquear transacionalmente os registros daquele item_type.

&nbsp;

Usar lock de linhas apropriado.

&nbsp;

NÃO usar advisory lock global.

&nbsp;

Objetivo:

&nbsp;

impedir alteração entre version check e UPDATE.

&nbsp;

Toda a função deve ser atômica:

ou todos atualizam ou nenhum.

&nbsp;

==================================================

4. GRAVAÇÃO DO REORDER

==================================================

&nbsp;

posição 1 → sort_order 10

posição 2 → 20

posição 3 → 30

etc.

&nbsp;

Atualizar:

&nbsp;

sort_order

version = version + 1

updated_at = now()

updated_by = auth.uid()

&nbsp;

Depois retornar todos os itens daquele item_type

ordenados por sort_order.

&nbsp;

==================================================

5. UPSERT CANÔNICO

==================================================

&nbsp;

Auditar e remover a assinatura legada de 11 args.

&nbsp;

Manter somente a versão canônica de 12 args:

&nbsp;

_item_type

_erp_item_id

_erp_description_snapshot

_enabled

_company_ids

_sort_order

_default_quantity

_quantity_step

_display_name

_requires_pickup

_expected_version

_logistics_type

&nbsp;

Preservar:

&nbsp;

SECURITY DEFINER

SET search_path = public

admin check

controle expected_version.

&nbsp;

Retornar a linha persistida.

&nbsp;

==================================================

6. SORT_ORDER AUTOMÁTICO

==================================================

&nbsp;

Novo item:

&nbsp;

_sort_order = NULL

&nbsp;

Banco calcula:

&nbsp;

COALESCE(MAX(sort_order),0) + 10

&nbsp;

para o mesmo item_type.

&nbsp;

Nunca criar novo item com ordem 0.

&nbsp;

Proteger esse cálculo contra concorrência usando

lock curto/específico por item_type.

&nbsp;

Item existente:

&nbsp;

_sort_order NULL significa preservar sort_order atual.

&nbsp;

Editar configuração NÃO altera posição.

&nbsp;

Somente o modo Ordenar altera posição existente.

&nbsp;

==================================================

7. EQUIPAMENTOS

==================================================

&nbsp;

Garantir persistência de:

&nbsp;

enabled

company_ids

requires_pickup

display_name

default_quantity

quantity_step

&nbsp;

Caso obrigatório:

&nbsp;

enabled=true

company_ids=[1,3]

requires_pickup=true

&nbsp;

Também validar:

&nbsp;

requires_pickup=false

&nbsp;

como valor válido e diferente de NULL.

&nbsp;

==================================================

8. LOGÍSTICA DE PRODUTO

==================================================

&nbsp;

Remover save imediato no onChange de:

&nbsp;

Comportamento Logístico.

&nbsp;

Criar estado local:

&nbsp;

logisticsType.

&nbsp;

Trocar o select altera somente estado local.

&nbsp;

Botão Salvar executa UMA ÚNICA mutation contendo toda

a configuração do item.

&nbsp;

Isso evita incrementar version no meio da edição.

&nbsp;

==================================================

9. CATALOG ITEM DIALOG

==================================================

&nbsp;

Remover completamente:

&nbsp;

sortOrder = "0"

&nbsp;

e o estado manual correspondente.

&nbsp;

Capturar expectedVersion quando o Dialog abrir.

&nbsp;

Botão Salvar envia uma única operação.

&nbsp;

Dialog só fecha após persistência confirmada.

&nbsp;

==================================================

10. ROUNDTRIP DO UPSERT

==================================================

&nbsp;

useUpsertCatalogSetting:

&nbsp;

1. validar draft;

2. chamar RPC;

3. validar linha retornada;

4. executar SELECT real por item_type + erp_item_id;

5. comparar o banco com o solicitado;

6. somente então retornar sucesso.

&nbsp;

Comparar:

&nbsp;

enabled

company_ids

requires_pickup

display_name

default_quantity

quantity_step

logistics_type

sort_order

version

&nbsp;

Normalizar company_ids antes da comparação.

&nbsp;

Se divergente:

&nbsp;

catalog_setting_persistence_mismatch

&nbsp;

Dialog permanece aberto.

&nbsp;

==================================================

11. ROUNDTRIP DO REORDER

==================================================

&nbsp;

useReorderCatalogItems:

&nbsp;

1. chamar RPC UMA vez;

2. validar data retornada;

3. comparar ordem retornada com orderedIds;

4. executar SELECT real do item_type ORDER BY sort_order;

5. comparar novamente.

&nbsp;

Sucesso somente se:

&nbsp;

requestedOrder

=

rpcReturnedOrder

=

databaseOrder

&nbsp;

Caso contrário:

&nbsp;

catalog_reorder_roundtrip_mismatch

&nbsp;

e permanecer no modo Ordenar.

&nbsp;

==================================================

12. DND

==================================================

&nbsp;

Preservar integralmente:

&nbsp;

@dnd-kit

TouchSensor

PointerSensor

KeyboardSensor

GripVertical

setas ↑ ↓

&nbsp;

Durante drag/setas:

&nbsp;

ZERO escrita.

&nbsp;

Somente:

&nbsp;

Salvar ordem

&nbsp;

persiste.

&nbsp;

Cancelar:

&nbsp;

ZERO RPC.

&nbsp;

==================================================

13. TYPES

==================================================

&nbsp;

Atualizar:

&nbsp;

src/integrations/supabase/types.ts

&nbsp;

Resultado final:

&nbsp;

admin_reorder_catalog_items

→ UMA assinatura apenas

&nbsp;

upsert_order_catalog_setting

→ UMA assinatura apenas

&nbsp;

Retornos corretamente tipados.

&nbsp;

Não usar novo `as any`.

&nbsp;

==================================================

14. SEGURANÇA

==================================================

&nbsp;

Preservar:

&nbsp;

SECURITY DEFINER

search_path fixo

REVOKE PUBLIC

REVOKE anon

&nbsp;

Não criar grants amplos de INSERT/UPDATE para resolver o problema.

&nbsp;

Continuar usando regra administrativa atual.

&nbsp;

Não iniciar admin.catalog/edit nesta sprint.

&nbsp;

==================================================

15. TESTES OBRIGATÓRIOS

==================================================

&nbsp;

REORDER:

&nbsp;

A,B,C → C,A,B

&nbsp;

Esperado:

&nbsp;

C=10

A=20

B=30

&nbsp;

RPC retorna C,A,B.

&nbsp;

SELECT confirma C,A,B.

&nbsp;

Cobrir também:

&nbsp;

- duplicado;

- ID inexistente;

- item_type errado;

- item faltando;

- version stale;

- não admin;

- zero update parcial em erro.

&nbsp;

UPSERT EQUIPAMENTO:

&nbsp;

disabled → enabled=true

company_ids=[1,3]

requires_pickup=true

&nbsp;

RPC + SELECT confirmam.

&nbsp;

Testar também requires_pickup=false.

&nbsp;

LOGÍSTICA:

&nbsp;

alterar select não chama RPC.

&nbsp;

Salvar chama exatamente UMA RPC.

&nbsp;

NOVO ITEM:

&nbsp;

existentes 10,20,30

novo → 40

nunca 0.

&nbsp;

EDIÇÃO:

&nbsp;

item existente sort_order=20

editar configuração

→ continua 20.

&nbsp;

==================================================

16. PLAYWRIGHT / TESTES DE UI

==================================================

&nbsp;

Se Playwright já estiver configurado no projeto,

adicionar testes de persistência.

&nbsp;

Se NÃO estiver configurado,

NÃO adicionar toda uma nova infraestrutura apenas para este hotfix.

&nbsp;

Usar Vitest/testes existentes + homologação manual final.

&nbsp;

==================================================

17. ESCOPO

==================================================

&nbsp;

Preservar visual atual do Catálogo.

&nbsp;

Preservar Novo Pedido integralmente.

&nbsp;

ZERO diff funcional em:

&nbsp;

erp-api/

Orders

Sellers

Admin Users

Mapa

&nbsp;

ZERO escrita Firebird.

&nbsp;

==================================================

18. CRITÉRIOS DE ACEITE

==================================================

&nbsp;

[ ] somente uma RPC reorder

[ ] somente uma RPC upsert

[ ] overloads antigos removidos

[ ] reorder retorna registros persistidos

[ ] snapshot completo validado

[ ] versions validadas

[ ] lock transacional aplicado

[ ] roundtrip reorder confirmado

&nbsp;

[ ] equipamento enabled persiste

[ ] company_ids persistem

[ ] requires_pickup persiste

[ ] logística persiste

[ ] roundtrip upsert confirmado

&nbsp;

[ ] save imediato de logística removido

[ ] uma mutation por Save

[ ] sortOrder=0 removido

[ ] novo item recebe MAX+10

[ ] existente preserva ordem

&nbsp;

[ ] types refletem banco live

[ ] testes persistidos

[ ] typecheck passa

[ ] build passa

[ ] Node zero diff

[ ] Firebird zero escrita

[ ] NÃO usar Fast Visual Edit

&nbsp;

==================================================

19. HOMOLOGAÇÃO

==================================================

&nbsp;

Após implementação:

&nbsp;

PARAR.

&nbsp;

NÃO declarar concluído.

&nbsp;

Aguardar revisão Git.

&nbsp;

Depois faremos:

&nbsp;

TESTE A:

ativar equipamento → salvar → recarregar → confirmar.

&nbsp;

TESTE B:

alterar ordem → salvar → recarregar → confirmar.

&nbsp;

==================================================

20. RELATÓRIO FINAL

==================================================

&nbsp;

Informar:

&nbsp;

1. assinaturas encontradas/removidas;

2. migrations novas;

3. causa do reorder;

4. causa do equipamento;

5. contrato final das RPCs;

6. lock/atomicidade;

7. roundtrip reorder;

8. roundtrip upsert;

9. logística;

10. MAX+10;

11. testes;

12. typecheck/build;

13. Node zero diff;

14. Firebird zero escrita.

&nbsp;

Depois:

&nbsp;

PARAR.

&nbsp;

NÃO iniciar Mapa.

NÃO iniciar Sprint 8.9.43.2.