CREATE OR REPLACE FUNCTION public.admin_reorder_catalog_items(
  _item_type public.catalog_item_type,
  _ordered_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _current_index integer := 1;
  _actor_id uuid;
BEGIN
  -- Security check: must be admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Validate actor
  _actor_id := auth.uid();
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Basic validation of IDs list
  IF _ordered_ids IS NULL OR array_length(_ordered_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Check for duplicates in the input list
  IF (SELECT count(*) FROM (SELECT unnest(_ordered_ids) AS id) t GROUP BY id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'invalid_ids_list: duplicates found';
  END IF;

  -- Validate that all IDs exist and belong to the correct item_type
  IF EXISTS (
    SELECT 1 
    FROM unnest(_ordered_ids) AS id
    LEFT JOIN public.order_catalog_settings s ON s.id = id
    WHERE s.id IS NULL OR s.item_type != _item_type
  ) THEN
    RAISE EXCEPTION 'invalid_ids_list: items not found or type mismatch';
  END IF;

  -- Update each item with a stable gap (10, 20, 30...)
  FOREACH _id IN ARRAY _ordered_ids
  LOOP
    UPDATE public.order_catalog_settings
    SET 
      sort_order = _current_index * 10,
      version = version + 1,
      updated_at = now()
    WHERE id = _id;
    
    _current_index := _current_index + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[]) TO service_role;