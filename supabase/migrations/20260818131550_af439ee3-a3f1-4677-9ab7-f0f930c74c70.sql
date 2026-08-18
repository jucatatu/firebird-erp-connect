-- REVOKE EXECUTE ON ADMIN FUNCTIONS FROM PUBLIC AND AUTHENTICATED
REVOKE EXECUTE ON FUNCTION public.admin_setup_invited_user(uuid, text, uuid, integer, integer[], text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_setup_invited_user(uuid, text, uuid, integer, integer[], text[]) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_update_user(uuid, text, boolean, uuid, integer, integer[], text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_user(uuid, text, boolean, uuid, integer, integer[], text[]) FROM authenticated;
