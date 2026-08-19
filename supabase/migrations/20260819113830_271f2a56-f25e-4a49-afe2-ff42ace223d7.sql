-- Revoke public execution from administrative SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[]) FROM anon;

-- Re-grant to specific roles (the function itself has internal has_role check)
GRANT EXECUTE ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reorder_catalog_items(public.catalog_item_type, uuid[]) TO service_role;