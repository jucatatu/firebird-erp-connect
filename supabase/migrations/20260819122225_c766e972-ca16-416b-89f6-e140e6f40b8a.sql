-- Migration: HOTFIX CATALOG UX.1.1 — LOCK CONCURRÊNCIA MAX+10
-- Data: 2026-08-19

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
  v_lock_key bigint;
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

    -- PROTEÇÃO DE CONCURRÊNCIA PARA MAX+10
    -- Lock advisory por item_type (1001 para product, 1002 para equipment)
    v_lock_key := CASE WHEN _item_type = 'product' THEN 1001 ELSE 1002 END;
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Calculate automatic sort_order if not provided
    IF _sort_order IS NULL THEN
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
