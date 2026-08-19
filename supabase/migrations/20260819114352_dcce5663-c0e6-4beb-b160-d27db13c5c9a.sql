-- Final corrective migration for atomic catalog reordering
-- Timestamp: 20260819120000

CREATE OR REPLACE FUNCTION public.admin_reorder_catalog_items(
  _item_type public.catalog_item_type,
  _ordered_ids uuid[],
  _expected_versions integer[]
)
RETURNS void
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
  -- 1. Security Check
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Verify admin role (using existing has_role logic)
  IF NOT public.has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 2. Basic Input Validation
  v_count_input := array_length(_ordered_ids, 1);
  IF v_count_input IS NULL OR v_count_input = 0 THEN
    RAISE EXCEPTION 'empty_id_list';
  END IF;

  IF v_count_input <> array_length(_expected_versions, 1) THEN
    RAISE EXCEPTION 'array_length_mismatch';
  END IF;

  -- 3. Duplicate Check (Corrected logic)
  IF EXISTS (
    SELECT id
    FROM unnest(_ordered_ids) AS id
    GROUP BY id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_ids_detected';
  END IF;

  -- 4. Snapshot Integrity Check (Complete list validation)
  SELECT count(*)
  INTO v_count_actual
  FROM public.order_catalog_settings
  WHERE item_type = _item_type;

  IF v_count_actual <> v_count_input THEN
    RAISE EXCEPTION 'catalog_reorder_conflict' USING DETAIL = 'Item count mismatch (snapshot is stale).';
  END IF;

  -- 5. Ownership and Membership Validation (All IDs must exist and match type)
  IF EXISTS (
    SELECT 1
    FROM unnest(_ordered_ids) AS id
    LEFT JOIN public.order_catalog_settings s ON s.id = id
    WHERE s.id IS NULL OR s.item_type <> _item_type
  ) THEN
    RAISE EXCEPTION 'invalid_ids_for_type';
  END IF;

  -- 6. Concurrency / Version Validation
  -- We check every item before any updates to ensure atomicity
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

  -- 7. Atomic Update
  -- We use multiples of 10 for sort_order
  FOR v_i IN 1..v_count_input LOOP
    UPDATE public.order_catalog_settings
    SET 
      sort_order = v_i * 10,
      version = version + 1,
      updated_at = now(),
      updated_by = v_admin_id
    WHERE id = _ordered_ids[v_i];
  END LOOP;

END;
$$;

-- Security hardening
REVOKE EXECUTE ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[], integer[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[], integer[]) FROM anon;

GRANT EXECUTE ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[], integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[], integer[]) TO service_role;