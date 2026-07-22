
-- Revoke public/anon execution on SECURITY DEFINER helpers/RPCs added in this phase.
-- Signed-in usage remains via explicit GRANT to authenticated.
REVOKE ALL ON FUNCTION public.has_company_access(uuid, smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_operation_status(uuid, public.operational_status, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reschedule_operation(uuid, date, text, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_company_access(uuid, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_operation_status(uuid, public.operational_status, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_operation(uuid, date, text, integer) TO authenticated;
