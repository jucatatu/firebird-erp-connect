-- Migration: HOTFIX CATALOG UX.1.3 — CORRIGIR SQLSTATE 42702 NO REORDER
-- Data: 2026-08-19

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

  -- Duplicate Check - Qualificado para evitar SQLSTATE 42702
  IF EXISTS (
    SELECT u.item_id
    FROM unnest(_ordered_ids) AS u(item_id)
    GROUP BY u.item_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_ids_detected';
  END IF;

  -- Lock all relevant rows for this item_type to prevent concurrent reorders
  -- Qualificado com ocs
  PERFORM 1 
  FROM public.order_catalog_settings AS ocs
  WHERE ocs.item_type = _item_type
  FOR UPDATE;

  -- Snapshot Integrity Check
  SELECT count(*)
  INTO v_count_actual
  FROM public.order_catalog_settings AS ocs
  WHERE ocs.item_type = _item_type;

  IF v_count_actual <> v_count_input THEN
    RAISE EXCEPTION 'catalog_reorder_conflict' USING DETAIL = 'Item count mismatch (snapshot is stale).';
  END IF;

  -- Validation: All IDs must exist and match item_type
  -- Qualificado com ocs e u
  IF EXISTS (
    SELECT 1
    FROM unnest(_ordered_ids) AS u(item_id)
    LEFT JOIN public.order_catalog_settings AS ocs ON ocs.id = u.item_id
    WHERE ocs.id IS NULL OR ocs.item_type <> _item_type
  ) THEN
    RAISE EXCEPTION 'invalid_ids_for_type';
  END IF;

  -- Concurrency / Version Validation
  -- Qualificado com ocs
  FOR v_i IN 1..v_count_input LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.order_catalog_settings AS ocs
      WHERE ocs.id = _ordered_ids[v_i]
        AND ocs.version = _expected_versions[v_i]
    ) THEN
      RAISE EXCEPTION 'catalog_reorder_conflict' USING DETAIL = 'One or more items have been updated by another user.';
    END IF;
  END LOOP;

  -- Atomic Update
  -- Qualificado com ocs
  FOR v_i IN 1..v_count_input LOOP
    UPDATE public.order_catalog_settings AS ocs
    SET 
      sort_order = v_i * 10,
      version = ocs.version + 1,
      updated_at = now(),
      updated_by = v_admin_id
    WHERE ocs.id = _ordered_ids[v_i];
  END LOOP;

  -- Return the updated set
  -- Qualificado com ocs
  RETURN QUERY 
  SELECT ocs.* 
  FROM public.order_catalog_settings AS ocs
  WHERE ocs.item_type = _item_type
  ORDER BY ocs.sort_order ASC, ocs.erp_item_id ASC;
END;
$$;

-- Garantir privilégios (Manter os mesmos da migration anterior)
REVOKE ALL ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[], integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[], integer[]) TO authenticated;
