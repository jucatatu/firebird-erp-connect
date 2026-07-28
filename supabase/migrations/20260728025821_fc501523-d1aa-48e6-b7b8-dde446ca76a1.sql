CREATE TYPE public.catalog_item_type AS ENUM ('product', 'equipment');
CREATE TYPE public.catalog_event_type AS ENUM ('created', 'enabled', 'disabled', 'updated', 'snapshot_updated');

CREATE TABLE public.order_catalog_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type public.catalog_item_type NOT NULL,
  erp_item_id bigint NOT NULL,
  erp_description_snapshot text NOT NULL,
  display_name text,
  enabled boolean NOT NULL DEFAULT false,
  company_ids integer[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  default_quantity numeric NOT NULL DEFAULT 1,
  quantity_step numeric NOT NULL DEFAULT 1,
  requires_pickup boolean,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,

  CONSTRAINT ocs_unique_item UNIQUE (item_type, erp_item_id),
  CONSTRAINT ocs_erp_item_id_positive CHECK (erp_item_id > 0),
  CONSTRAINT ocs_snapshot_len CHECK (char_length(erp_description_snapshot) BETWEEN 1 AND 300),
  CONSTRAINT ocs_display_name_len CHECK (display_name IS NULL OR char_length(btrim(display_name)) BETWEEN 1 AND 120),
  CONSTRAINT ocs_sort_order_range CHECK (sort_order BETWEEN 0 AND 100000),
  CONSTRAINT ocs_default_quantity_positive CHECK (default_quantity > 0 AND default_quantity <= 100000),
  CONSTRAINT ocs_quantity_step_positive CHECK (quantity_step > 0 AND quantity_step <= 100000),
  CONSTRAINT ocs_company_ids_domain CHECK (company_ids <@ ARRAY[1,3]),
  CONSTRAINT ocs_pickup_product_null CHECK (item_type <> 'product' OR requires_pickup IS NULL),
  CONSTRAINT ocs_pickup_equipment_defined CHECK (item_type <> 'equipment' OR enabled = false OR requires_pickup IS NOT NULL),
  CONSTRAINT ocs_enabled_requires_company CHECK (enabled = false OR array_length(company_ids, 1) >= 1)
);

CREATE INDEX ocs_type_enabled_idx ON public.order_catalog_settings (item_type, enabled);
CREATE INDEX ocs_sort_idx ON public.order_catalog_settings (item_type, sort_order, erp_item_id);
CREATE INDEX ocs_company_gin_idx ON public.order_catalog_settings USING GIN (company_ids);

GRANT SELECT ON public.order_catalog_settings TO authenticated;
GRANT ALL ON public.order_catalog_settings TO service_role;

ALTER TABLE public.order_catalog_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog: admin lê tudo"
  ON public.order_catalog_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "catalog: autenticado lê habilitados"
  ON public.order_catalog_settings FOR SELECT TO authenticated
  USING (enabled = true);

CREATE POLICY "catalog: admin insere"
  ON public.order_catalog_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "catalog: admin atualiza"
  ON public.order_catalog_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER order_catalog_settings_set_updated_at
  BEFORE UPDATE ON public.order_catalog_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.order_catalog_setting_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_id uuid REFERENCES public.order_catalog_settings(id) ON DELETE SET NULL,
  item_type public.catalog_item_type NOT NULL,
  erp_item_id bigint NOT NULL,
  event_type public.catalog_event_type NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ocse_item_idx ON public.order_catalog_setting_events (item_type, erp_item_id, created_at DESC);

GRANT SELECT ON public.order_catalog_setting_events TO authenticated;
GRANT ALL ON public.order_catalog_setting_events TO service_role;

ALTER TABLE public.order_catalog_setting_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog histórico: admin lê"
  ON public.order_catalog_setting_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

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
  _expected_version integer DEFAULT NULL
)
RETURNS public.order_catalog_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.order_catalog_settings;
  v_row public.order_catalog_settings;
  v_companies integer[];
  v_display text;
  v_snapshot text;
  v_event public.catalog_event_type;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _erp_item_id IS NULL OR _erp_item_id <= 0 THEN
    RAISE EXCEPTION 'invalid_erp_item_id' USING ERRCODE = '22023';
  END IF;

  v_snapshot := btrim(COALESCE(_erp_description_snapshot, ''));
  IF v_snapshot = '' OR char_length(v_snapshot) > 300 THEN
    RAISE EXCEPTION 'invalid_snapshot' USING ERRCODE = '22023';
  END IF;

  v_display := NULLIF(btrim(COALESCE(_display_name, '')), '');
  IF v_display IS NOT NULL AND char_length(v_display) > 120 THEN
    RAISE EXCEPTION 'invalid_display_name' USING ERRCODE = '22023';
  END IF;

  SELECT ARRAY(SELECT DISTINCT c FROM unnest(COALESCE(_company_ids, '{}'::integer[])) AS c ORDER BY c)
    INTO v_companies;
  IF NOT (v_companies <@ ARRAY[1,3]) THEN
    RAISE EXCEPTION 'invalid_company_ids' USING ERRCODE = '22023';
  END IF;

  IF _default_quantity IS NULL OR _default_quantity <= 0 OR _default_quantity > 100000 THEN
    RAISE EXCEPTION 'invalid_default_quantity' USING ERRCODE = '22023';
  END IF;
  IF _quantity_step IS NULL OR _quantity_step <= 0 OR _quantity_step > 100000 THEN
    RAISE EXCEPTION 'invalid_quantity_step' USING ERRCODE = '22023';
  END IF;
  IF _sort_order IS NULL OR _sort_order < 0 OR _sort_order > 100000 THEN
    RAISE EXCEPTION 'invalid_sort_order' USING ERRCODE = '22023';
  END IF;

  IF _item_type = 'product' AND _requires_pickup IS NOT NULL THEN
    RAISE EXCEPTION 'product_cannot_require_pickup' USING ERRCODE = '22023';
  END IF;
  IF _item_type = 'equipment' AND COALESCE(_enabled, false) AND _requires_pickup IS NULL THEN
    RAISE EXCEPTION 'equipment_requires_pickup_definition' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(_enabled, false) AND COALESCE(array_length(v_companies, 1), 0) = 0 THEN
    RAISE EXCEPTION 'enabled_requires_company' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
    FROM public.order_catalog_settings
   WHERE item_type = _item_type AND erp_item_id = _erp_item_id
   FOR UPDATE;

  IF NOT FOUND THEN
    IF _expected_version IS NOT NULL THEN
      RAISE EXCEPTION 'catalog_setting_conflict' USING ERRCODE = 'P0004';
    END IF;

    INSERT INTO public.order_catalog_settings (
      item_type, erp_item_id, erp_description_snapshot, display_name, enabled,
      company_ids, sort_order, default_quantity, quantity_step, requires_pickup,
      created_by, updated_by
    ) VALUES (
      _item_type, _erp_item_id, v_snapshot, v_display, COALESCE(_enabled, false),
      v_companies, _sort_order, _default_quantity, _quantity_step, _requires_pickup,
      v_uid, v_uid
    ) RETURNING * INTO v_row;

    INSERT INTO public.order_catalog_setting_events (
      setting_id, item_type, erp_item_id, event_type, previous_value, new_value, actor_id
    ) VALUES (v_row.id, _item_type, _erp_item_id, 'created', NULL, to_jsonb(v_row), v_uid);

    IF v_row.enabled THEN
      INSERT INTO public.order_catalog_setting_events (
        setting_id, item_type, erp_item_id, event_type, previous_value, new_value, actor_id
      ) VALUES (v_row.id, _item_type, _erp_item_id, 'enabled', NULL, to_jsonb(v_row), v_uid);
    END IF;

    RETURN v_row;
  END IF;

  IF _expected_version IS NULL OR _expected_version <> v_existing.version THEN
    RAISE EXCEPTION 'catalog_setting_conflict' USING ERRCODE = 'P0004';
  END IF;

  UPDATE public.order_catalog_settings
     SET erp_description_snapshot = v_snapshot,
         display_name = v_display,
         enabled = COALESCE(_enabled, false),
         company_ids = v_companies,
         sort_order = _sort_order,
         default_quantity = _default_quantity,
         quantity_step = _quantity_step,
         requires_pickup = _requires_pickup,
         updated_by = v_uid,
         version = version + 1
   WHERE id = v_existing.id
   RETURNING * INTO v_row;

  IF to_jsonb(v_row) - 'version' - 'updated_at' - 'updated_by'
     = to_jsonb(v_existing) - 'version' - 'updated_at' - 'updated_by' THEN
    RETURN v_row;
  END IF;

  IF v_row.enabled AND NOT v_existing.enabled THEN
    v_event := 'enabled';
  ELSIF NOT v_row.enabled AND v_existing.enabled THEN
    v_event := 'disabled';
  ELSIF v_row.erp_description_snapshot IS DISTINCT FROM v_existing.erp_description_snapshot
        AND to_jsonb(v_row) - 'version' - 'updated_at' - 'updated_by' - 'erp_description_snapshot'
            = to_jsonb(v_existing) - 'version' - 'updated_at' - 'updated_by' - 'erp_description_snapshot' THEN
    v_event := 'snapshot_updated';
  ELSE
    v_event := 'updated';
  END IF;

  INSERT INTO public.order_catalog_setting_events (
    setting_id, item_type, erp_item_id, event_type, previous_value, new_value, actor_id
  ) VALUES (v_row.id, _item_type, _erp_item_id, v_event, to_jsonb(v_existing), to_jsonb(v_row), v_uid);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_order_catalog_setting(
  public.catalog_item_type, bigint, text, boolean, integer[], integer, numeric, numeric, text, boolean, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.upsert_order_catalog_setting(
  public.catalog_item_type, bigint, text, boolean, integer[], integer, numeric, numeric, text, boolean, integer
) TO authenticated;