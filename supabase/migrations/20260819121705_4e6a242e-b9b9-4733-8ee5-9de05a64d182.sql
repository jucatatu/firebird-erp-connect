-- Migration: HOTFIX CATALOG UX.1 — PERSISTÊNCIA INTEGRAL DO CATÁLOGO
-- Data: 2026-08-19

-- 1. Remover assinaturas legadas do Reorder
REVOKE EXECUTE ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[]) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.admin_reorder_catalog_items(public.catalog_item_type, uuid[]);

-- 2. Remover assinatura atual para mudar retorno
REVOKE EXECUTE ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[], integer[]) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.admin_reorder_catalog_items(public.catalog_item_type, uuid[], integer[]);

-- 3. Criar a RPC Final de Reorder com validação rigorosa e retorno tipado
CREATE OR REPLACE FUNCTION public.admin_reorder_catalog_items(
  _item_type public.catalog_item_type,
  _ordered_ids uuid[],
  _expected_versions integer[]
)
RETURNS SETOF public.order_catalog_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_count_actual integer;
  v_count_input integer;
  v_i integer;
BEGIN
  -- Security check
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF NOT public.has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Basic input validation
  v_count_input := array_length(_ordered_ids, 1);
  IF v_count_input IS NULL OR v_count_input = 0 THEN
    RAISE EXCEPTION 'empty_id_list';
  END IF;

  IF v_count_input <> array_length(_expected_versions, 1) THEN
    RAISE EXCEPTION 'array_length_mismatch';
  END IF;

  -- Duplicate Check
  IF EXISTS (
    SELECT id
    FROM unnest(_ordered_ids) AS id
    GROUP BY id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_ids_detected';
  END IF;

  -- Lock all relevant rows for this item_type to prevent concurrent reorders
  -- and ensure snapshot integrity.
  PERFORM 1 
  FROM public.order_catalog_settings
  WHERE item_type = _item_type
  FOR UPDATE;

  -- Snapshot Integrity Check (Must include ALL items of that type)
  SELECT count(*)
  INTO v_count_actual
  FROM public.order_catalog_settings
  WHERE item_type = _item_type;

  IF v_count_actual <> v_count_input THEN
    RAISE EXCEPTION 'catalog_reorder_conflict' USING DETAIL = 'Item count mismatch (snapshot is stale).';
  END IF;

  -- Validation: All IDs must exist and match item_type
  IF EXISTS (
    SELECT 1
    FROM unnest(_ordered_ids) AS id
    LEFT JOIN public.order_catalog_settings s ON s.id = id
    WHERE s.id IS NULL OR s.item_type <> _item_type
  ) THEN
    RAISE EXCEPTION 'invalid_ids_for_type';
  END IF;

  -- Concurrency / Version Validation
  FOR v_i IN 1..v_count_input LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.order_catalog_settings
      WHERE id = _ordered_ids[v_i]
        AND version = _expected_versions[v_i]
    ) THEN
      RAISE EXCEPTION 'catalog_reorder_conflict' USING DETAIL = 'One or more items have been updated by another user.';
    END IF;
  END LOOP;

  -- Atomic Update
  FOR v_i IN 1..v_count_input LOOP
    UPDATE public.order_catalog_settings
    SET 
      sort_order = v_i * 10,
      version = version + 1,
      updated_at = now(),
      updated_by = v_admin_id
    WHERE id = _ordered_ids[v_i];
  END LOOP;

  -- Return the updated set
  RETURN QUERY 
  SELECT * 
  FROM public.order_catalog_settings
  WHERE item_type = _item_type
  ORDER BY sort_order ASC, erp_item_id ASC;
END;
$$;

-- Grant Reorder
REVOKE ALL ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[], integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[], integer[]) TO authenticated;

-- 4. Remover overloads de Upsert
DROP FUNCTION IF EXISTS public.upsert_order_catalog_setting(public.catalog_item_type, bigint, text, boolean, integer[], integer, numeric, numeric, text, boolean, integer);
DROP FUNCTION IF EXISTS public.upsert_order_catalog_setting(public.catalog_item_type, bigint, text, boolean, integer[], integer, numeric, numeric, text, boolean, integer, public.logistics_type);

-- 5. Criar a RPC Final de Upsert (Canonical 12 args)
CREATE OR REPLACE FUNCTION public.upsert_order_catalog_setting(
  _item_type public.catalog_item_type,
  _erp_item_id bigint,
  _erp_description_snapshot text,
  _enabled boolean,
  _company_ids integer[],
  _sort_order integer,
  _default_quantity numeric,
  _quantity_step numeric,
  _display_name text DEFAULT NULL,
  _requires_pickup boolean DEFAULT NULL,
  _expected_version integer DEFAULT NULL,
  _logistics_type public.logistics_type DEFAULT NULL
)
RETURNS public.order_catalog_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_existing public.order_catalog_settings;
  v_row public.order_catalog_settings;
  v_new_sort_order integer;
BEGIN
  -- Security
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF NOT public.has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Business rules validation
  IF _item_type = 'product' AND _requires_pickup IS NOT NULL THEN
    RAISE EXCEPTION 'product_cannot_require_pickup';
  END IF;
  
  IF _item_type = 'equipment' AND _enabled AND _requires_pickup IS NULL THEN
    RAISE EXCEPTION 'equipment_requires_pickup_definition';
  END IF;

  -- Lock specific item row if exists
  SELECT * INTO v_existing
  FROM public.order_catalog_settings
  WHERE item_type = _item_type AND erp_item_id = _erp_item_id
  FOR UPDATE;

  IF FOUND THEN
    -- Check concurrency
    IF _expected_version IS NOT NULL AND v_existing.version <> _expected_version THEN
      RAISE EXCEPTION 'catalog_setting_conflict';
    END IF;

    UPDATE public.order_catalog_settings
    SET 
      erp_description_snapshot = _erp_description_snapshot,
      display_name = _display_name,
      enabled = _enabled,
      company_ids = _company_ids,
      -- Preserve existing sort_order if _sort_order is NULL
      sort_order = COALESCE(_sort_order, sort_order),
      default_quantity = _default_quantity,
      quantity_step = _quantity_step,
      requires_pickup = _requires_pickup,
      logistics_type = _logistics_type,
      version = version + 1,
      updated_at = now(),
      updated_by = v_admin_id
    WHERE id = v_existing.id
    RETURNING * INTO v_row;

    -- Event registration
    INSERT INTO public.order_catalog_setting_events (
      setting_id, item_type, erp_item_id, event_type, actor_id, new_value, previous_value
    ) VALUES (
      v_row.id, v_row.item_type, v_row.erp_item_id, 'updated', v_admin_id, to_jsonb(v_row), to_jsonb(v_existing)
    );

  ELSE
    -- Creation case
    IF _expected_version IS NOT NULL THEN
      RAISE EXCEPTION 'catalog_setting_conflict' USING DETAIL = 'Item was expected to exist but did not.';
    END IF;

    -- Calculate automatic sort_order if not provided
    IF _sort_order IS NULL THEN
      -- Quick MAX + 10 for the same item_type
      SELECT COALESCE(MAX(sort_order), 0) + 10 INTO v_new_sort_order
      FROM public.order_catalog_settings
      WHERE item_type = _item_type;
    ELSE
      v_new_sort_order := _sort_order;
    END IF;

    INSERT INTO public.order_catalog_settings (
      item_type,
      erp_item_id,
      erp_description_snapshot,
      display_name,
      enabled,
      company_ids,
      sort_order,
      default_quantity,
      quantity_step,
      requires_pickup,
      logistics_type,
      version,
      created_by,
      updated_by
    ) VALUES (
      _item_type,
      _erp_item_id,
      _erp_description_snapshot,
      _display_name,
      _enabled,
      _company_ids,
      v_new_sort_order,
      _default_quantity,
      _quantity_step,
      _requires_pickup,
      _logistics_type,
      1,
      v_admin_id,
      v_admin_id
    )
    RETURNING * INTO v_row;

    INSERT INTO public.order_catalog_setting_events (
      setting_id, item_type, erp_item_id, event_type, actor_id, new_value
    ) VALUES (
      v_row.id, v_row.item_type, v_row.erp_item_id, 'created', v_admin_id, to_jsonb(v_row)
    );
  END IF;

  RETURN v_row;
END;
$$;

-- Grant Upsert
REVOKE ALL ON FUNCTION public.upsert_order_catalog_setting(public.catalog_item_type, bigint, text, boolean, integer[], integer, numeric, numeric, text, boolean, integer, public.logistics_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_order_catalog_setting(public.catalog_item_type, bigint, text, boolean, integer[], integer, numeric, numeric, text, boolean, integer, public.logistics_type) TO authenticated;
