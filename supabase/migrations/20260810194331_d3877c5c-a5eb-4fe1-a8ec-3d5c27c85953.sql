-- SPRINT 8.9.8: Atualização da RPC de upsert para suportar logistics_type
CREATE OR REPLACE FUNCTION public.upsert_order_catalog_setting(
  _item_type public.catalog_item_type,
  _erp_item_id bigint,
  _erp_description_snapshot text,
  _enabled boolean,
  _company_ids integer[],
  _sort_order integer, _default_quantity numeric,
  _quantity_step numeric,
  _display_name text DEFAULT NULL::text,
  _requires_pickup boolean DEFAULT NULL::boolean,
  _expected_version integer DEFAULT NULL::integer,
  _logistics_type public.logistics_type DEFAULT NULL::public.logistics_type
)
RETURNS public.order_catalog_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_current_version integer;
  v_row public.order_catalog_settings;
BEGIN
  -- 1. Verificar permissão de admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 2. Validar regras básicas
  IF _item_type = 'product' AND _requires_pickup IS NOT NULL THEN
    RAISE EXCEPTION 'product_cannot_require_pickup';
  END IF;
  
  IF _item_type = 'equipment' AND _enabled AND _requires_pickup IS NULL THEN
    RAISE EXCEPTION 'equipment_requires_pickup_definition';
  END IF;

  -- 3. Buscar registro existente
  SELECT id, version INTO v_id, v_current_version
  FROM order_catalog_settings
  WHERE item_type = _item_type AND erp_item_id = _erp_item_id;

  -- 4. Upsert
  IF v_id IS NOT NULL THEN
    -- Verificação de concorrência se a versão for fornecida
    IF _expected_version IS NOT NULL AND v_current_version <> _expected_version THEN
      RAISE EXCEPTION 'catalog_setting_conflict';
    END IF;

    UPDATE order_catalog_settings
    SET 
      erp_description_snapshot = _erp_description_snapshot,
      display_name = _display_name,
      enabled = _enabled,
      company_ids = _company_ids,
      sort_order = _sort_order,
      default_quantity = _default_quantity,
      quantity_step = _quantity_step,
      requires_pickup = _requires_pickup,
      logistics_type = _logistics_type,
      version = version + 1,
      updated_at = now(),
      updated_by = auth.uid()
    WHERE id = v_id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO order_catalog_settings (
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
      _sort_order,
      _default_quantity,
      _quantity_step,
      _requires_pickup,
      _logistics_type,
      1,
      auth.uid(),
      auth.uid()
    )
    RETURNING * INTO v_row;
  END IF;

  -- Registrar evento
  INSERT INTO order_catalog_setting_events (
    setting_id,
    item_type,
    erp_item_id,
    event_type,
    actor_id,
    new_value
  ) VALUES (
    v_row.id,
    v_row.item_type,
    v_row.erp_item_id,
    CASE WHEN v_id IS NULL THEN 'created'::public.catalog_event_type ELSE 'updated'::public.catalog_event_type END,
    auth.uid(),
    to_jsonb(v_row)
  );

  RETURN v_row;
END;
$$;
