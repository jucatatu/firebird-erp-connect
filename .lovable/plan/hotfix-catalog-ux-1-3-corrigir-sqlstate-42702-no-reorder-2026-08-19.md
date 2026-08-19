# HOTFIX CATALOG UX.1.3 — CORRIGIR SQLSTATE 42702 NO REORDER

&nbsp;

## PROBLEMA CONFIRMADO

&nbsp;

Ao salvar ordem de Produtos ou Equipamentos ocorre:

&nbsp;

[42702] column reference "id" is ambiguous

&nbsp;

A falha está dentro da RPC:

&nbsp;

admin_reorder_catalog_items

&nbsp;

NÃO é neste momento um problema de cache/version.

NÃO implementar preflight SELECT no frontend nesta sprint.

&nbsp;

Objetivo:

corrigir somente a ambiguidade SQL mantendo toda a segurança

e o roundtrip já implementados.

&nbsp;

NÃO alterar Firebird, erp-api, Orders, Sellers, Mapa ou permissões.

&nbsp;

==================================================

1. NOVA MIGRATION

==================================================

&nbsp;

Criar UMA nova migration.

&nbsp;

NÃO editar migrations antigas.

&nbsp;

Recriar via CREATE OR REPLACE apenas:

&nbsp;

public.admin_reorder_catalog_items(

  _item_type catalog_item_type,

  _ordered_ids uuid[],

  _expected_versions integer[]

)

&nbsp;

Preservar a mesma assinatura e retorno atual:

&nbsp;

RETURNS SETOF public.order_catalog_settings

&nbsp;

==================================================

2. CORRIGIR TODAS AS REFERÊNCIAS AMBÍGUAS

==================================================

&nbsp;

Não usar:

&nbsp;

FROM unnest(_ordered_ids) AS id

&nbsp;

Usar alias de tabela + coluna explícita:

&nbsp;

FROM unnest(_ordered_ids) AS u(item_id)

&nbsp;

Duplicate check:

&nbsp;

SELECT u.item_id

FROM unnest(_ordered_ids) AS u(item_id)

GROUP BY u.item_id

HAVING count(*) > 1

&nbsp;

Validação dos IDs:

&nbsp;

FROM unnest(_ordered_ids) AS u(item_id)

LEFT JOIN public.order_catalog_settings AS ocs

  ON ocs.id = u.item_id

&nbsp;

WHERE

  ocs.id IS NULL

  OR ocs.item_type <> _item_type

&nbsp;

==================================================

3. QUALIFICAR COLUNAS DA TABELA

==================================================

&nbsp;

Dentro de toda a RPC usar alias explícito:

&nbsp;

public.order_catalog_settings AS ocs

&nbsp;

Exemplos:

&nbsp;

ocs.id

ocs.item_type

ocs.version

ocs.sort_order

ocs.erp_item_id

&nbsp;

Não deixar referências soltas como:

&nbsp;

id

version

item_type

sort_order

erp_item_id

&nbsp;

quando estiverem em SELECT/WHERE/JOIN/ORDER BY.

&nbsp;

==================================================

4. LOCK

==================================================

&nbsp;

Preservar:

&nbsp;

SELECT ...

FROM public.order_catalog_settings AS ocs

WHERE ocs.item_type = _item_type

FOR UPDATE

&nbsp;

Não remover lock.

&nbsp;

==================================================

5. SNAPSHOT

==================================================

&nbsp;

Preservar validação:

&nbsp;

quantidade de IDs enviados

==

quantidade total daquele item_type.

&nbsp;

Usar:

&nbsp;

WHERE ocs.item_type = _item_type

&nbsp;

Não alterar regra nesta hotfix.

&nbsp;

==================================================

6. VERSION CHECK

==================================================

&nbsp;

Preservar optimistic concurrency.

&nbsp;

Para cada índice:

&nbsp;

SELECT/EXISTS

FROM public.order_catalog_settings AS ocs

WHERE

  ocs.id = _ordered_ids[v_i]

  AND ocs.version = _expected_versions[v_i]

&nbsp;

Não remover expectedVersions.

&nbsp;

==================================================

7. UPDATE

==================================================

&nbsp;

Qualificar também o UPDATE:

&nbsp;

UPDATE public.order_catalog_settings AS ocs

SET

  sort_order = v_i * 10,

  version = ocs.version + 1,

  updated_at = now(),

  updated_by = v_admin_id

WHERE ocs.id = _ordered_ids[v_i];

&nbsp;

Preservar atomicidade.

&nbsp;

==================================================

8. RETURN

==================================================

&nbsp;

Preservar retorno completo.

&nbsp;

Usar:

&nbsp;

RETURN QUERY

SELECT ocs.*

FROM public.order_catalog_settings AS ocs

WHERE ocs.item_type = _item_type

ORDER BY ocs.sort_order ASC, ocs.erp_item_id ASC;

&nbsp;

==================================================

9. SEGURANÇA

==================================================

&nbsp;

Preservar:

&nbsp;

SECURITY DEFINER

SET search_path = public

auth.uid()

has_role(..., 'admin')

GRANT EXECUTE authenticated

REVOKE PUBLIC/anon conforme padrão atual.

&nbsp;

Não criar permissão nova.

&nbsp;

==================================================

10. FRONTEND

==================================================

&nbsp;

NÃO implementar o plano de preflight desta vez.

&nbsp;

Preservar useReorderCatalogItems atual:

&nbsp;

RPC

→ validar retorno

→ SELECT posterior

→ validar ordem persistida.

&nbsp;

Preservar expectedVersions atual.

&nbsp;

Preservar erro inline e Toaster.

&nbsp;

ZERO mudança no DnD.

&nbsp;

==================================================

11. TESTE SQL OBRIGATÓRIO

==================================================

&nbsp;

Garantir que a nova RPC não contenha padrões ambíguos:

&nbsp;

unnest(...) AS id

s.id = id

WHERE id =

ORDER BY sort_order sem alias

&nbsp;

Todos os campos SQL devem estar qualificados.

&nbsp;

Adicionar teste/regressão que detecte novamente

referência ambígua a id na implementação da RPC.

&nbsp;

==================================================

12. HOMOLOGAÇÃO

==================================================

&nbsp;

Após implementação:

&nbsp;

PARAR para revisão Git.

&nbsp;

Depois testar:

&nbsp;

PRODUTOS:

1. alterar duas posições;

2. Salvar ordem;

3. deve mostrar sucesso;

4. recarregar;

5. ordem deve permanecer.

&nbsp;

EQUIPAMENTOS:

mesmo procedimento.

&nbsp;

==================================================

13. EQUIPAMENTO ATIVAR/DESATIVAR

==================================================

&nbsp;

NÃO alterar upsert_order_catalog_setting nesta hotfix

sem erro comprovado.

&nbsp;

Depois do reorder funcionar, testar novamente:

&nbsp;

Disponível no aplicativo → Salvar.

&nbsp;

Se falhar, o Toaster agora mostrará o erro real

e faremos a correção específica do upsert.

&nbsp;

==================================================

14. ESCOPO

==================================================

&nbsp;

Esperado:

&nbsp;

1 nova migration

eventual teste

&nbsp;

Preferencialmente ZERO alteração frontend.

&nbsp;

ZERO diff:

erp-api/

Orders

Sellers

Admin Users

Mapa.

&nbsp;

==================================================

15. FINAL

==================================================

&nbsp;

Relatar:

&nbsp;

1. migration criada;

2. pontos ambíguos removidos;

3. assinatura RPC preservada;

4. FOR UPDATE preservado;

5. versions preservadas;

6. roundtrip frontend preservado;

7. testes;

8. build/typecheck;

9. Node zero diff;

10. Firebird zero escrita.

&nbsp;

PARAR.

NÃO iniciar Mapa.

NÃO iniciar Sprint 8.9.43.2.