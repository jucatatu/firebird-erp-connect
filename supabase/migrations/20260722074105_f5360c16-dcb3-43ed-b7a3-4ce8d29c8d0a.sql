
-- ============================================================
-- FASE 3D.1 — hardening
-- ============================================================

-- 1) Tabela de vínculo usuário × empresa
CREATE TABLE IF NOT EXISTS public.user_company_access (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (user_id, company_id)
);

GRANT SELECT ON public.user_company_access TO authenticated;
GRANT ALL ON public.user_company_access TO service_role;

ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uca_select_own_or_admin" ON public.user_company_access;
CREATE POLICY "uca_select_own_or_admin" ON public.user_company_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "uca_admin_manage" ON public.user_company_access;
CREATE POLICY "uca_admin_manage" ON public.user_company_access
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Helper de acesso por empresa
CREATE OR REPLACE FUNCTION public.has_company_access(_uid uuid, _company_id smallint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_uid, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.user_company_access
      WHERE user_id = _uid
        AND company_id IS NOT DISTINCT FROM _company_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_company_access(uuid, smallint) TO authenticated;

-- 3) operation_states: version + nova chave única
ALTER TABLE public.operation_states
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE public.operation_states
  DROP CONSTRAINT IF EXISTS operation_states_operation_date_erp_order_id_key;

ALTER TABLE public.operation_states
  DROP CONSTRAINT IF EXISTS operation_states_company_erp_order_uk;
ALTER TABLE public.operation_states
  ADD CONSTRAINT operation_states_company_erp_order_uk
  UNIQUE NULLS NOT DISTINCT (company_id, erp_order_id);

-- 4) RLS operation_states (drop e recria)
DROP POLICY IF EXISTS "states_select_own_or_privileged" ON public.operation_states;
DROP POLICY IF EXISTS "states_update_own_or_privileged" ON public.operation_states;
DROP POLICY IF EXISTS "states_insert_authenticated"    ON public.operation_states;
DROP POLICY IF EXISTS "states_delete_admin"            ON public.operation_states;

CREATE POLICY "states_select_by_company" ON public.operation_states
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "states_insert_by_company" ON public.operation_states
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "states_update_by_company" ON public.operation_states
  FOR UPDATE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "states_delete_admin" ON public.operation_states
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) RLS operation_events (append-only, escopo por empresa)
DROP POLICY IF EXISTS "events_select_via_state"   ON public.operation_events;
DROP POLICY IF EXISTS "events_insert_via_state"   ON public.operation_events;
DROP POLICY IF EXISTS "events_select_via_company" ON public.operation_events;
DROP POLICY IF EXISTS "events_insert_via_company" ON public.operation_events;

CREATE POLICY "events_select_via_company" ON public.operation_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.operation_states s
    WHERE s.id = operation_events.operation_state_id
      AND public.has_company_access(auth.uid(), s.company_id)
  ));

CREATE POLICY "events_insert_via_company" ON public.operation_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.operation_states s
    WHERE s.id = operation_events.operation_state_id
      AND public.has_company_access(auth.uid(), s.company_id)
  ));
-- Sem UPDATE/DELETE = append-only para todos, inclusive admin.

-- 6) RLS operation_notes
DROP POLICY IF EXISTS "notes_select_via_state"   ON public.operation_notes;
DROP POLICY IF EXISTS "notes_insert_via_state"   ON public.operation_notes;
DROP POLICY IF EXISTS "notes_select_via_company" ON public.operation_notes;
DROP POLICY IF EXISTS "notes_insert_via_company" ON public.operation_notes;

CREATE POLICY "notes_select_via_company" ON public.operation_notes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.operation_states s
    WHERE s.id = operation_notes.operation_state_id
      AND public.has_company_access(auth.uid(), s.company_id)
  ));

CREATE POLICY "notes_insert_via_company" ON public.operation_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.operation_states s
      WHERE s.id = operation_notes.operation_state_id
        AND public.has_company_access(auth.uid(), s.company_id)
    )
  );

-- 7) RPC: aplicar transição de status com matriz + versão
CREATE OR REPLACE FUNCTION public.apply_operation_status(
  _state_id uuid,
  _new_status public.operational_status,
  _expected_version integer,
  _reason text DEFAULT NULL
) RETURNS public.operation_states
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.operation_states;
  v_old public.operational_status;
  v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.operation_states WHERE id = _state_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'operation_state_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_company_access(auth.uid(), v_row.company_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_row.version <> _expected_version THEN
    RAISE EXCEPTION 'operation_state_conflict' USING ERRCODE = 'P0004';
  END IF;

  v_old := v_row.operational_status;
  IF v_old = _new_status THEN
    RETURN v_row;
  END IF;

  v_allowed := CASE v_old
    WHEN 'pending'            THEN _new_status IN ('in_progress','delivered','collected','customer_will_call','not_found','rescheduled')
    WHEN 'in_progress'        THEN _new_status IN ('delivered','collected','customer_will_call','not_found','rescheduled')
    WHEN 'customer_will_call' THEN _new_status IN ('in_progress','delivered','not_found','rescheduled')
    WHEN 'not_found'          THEN _new_status IN ('in_progress','delivered','rescheduled')
    WHEN 'rescheduled'        THEN _new_status IN ('pending','in_progress')
    ELSE FALSE
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid_transition'
      USING ERRCODE = '22023',
            DETAIL  = format('from=%s to=%s', v_old, _new_status);
  END IF;

  IF _new_status = 'rescheduled' AND (_reason IS NULL OR btrim(_reason) = '') THEN
    RAISE EXCEPTION 'reschedule_reason_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.operation_states
     SET operational_status = _new_status,
         reschedule_reason  = CASE WHEN _new_status = 'rescheduled' THEN _reason ELSE reschedule_reason END,
         updated_by         = auth.uid(),
         version            = version + 1
   WHERE id = _state_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_operation_status(uuid, public.operational_status, integer, text) TO authenticated;

-- 8) RPC: reagendamento (muda operational_date, preserva operation_date)
CREATE OR REPLACE FUNCTION public.reschedule_operation(
  _state_id uuid,
  _new_date date,
  _reason text,
  _expected_version integer
) RETURNS public.operation_states
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.operation_states;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.operation_states WHERE id = _state_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'operation_state_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_company_access(auth.uid(), v_row.company_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_row.version <> _expected_version THEN
    RAISE EXCEPTION 'operation_state_conflict' USING ERRCODE = 'P0004';
  END IF;

  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'reschedule_reason_required' USING ERRCODE = '22023';
  END IF;

  IF v_row.operational_status IN ('delivered','collected') THEN
    RAISE EXCEPTION 'invalid_transition'
      USING ERRCODE = '22023',
            DETAIL  = format('cannot reschedule terminal status: %s', v_row.operational_status);
  END IF;

  UPDATE public.operation_states
     SET operational_status = 'rescheduled',
         operational_date   = _new_date,
         reschedule_reason  = _reason,
         updated_by         = auth.uid(),
         version            = version + 1
   WHERE id = _state_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reschedule_operation(uuid, date, text, integer) TO authenticated;

-- 9) Backfill: admin já existente ganha acesso às empresas 1 e 3
INSERT INTO public.user_company_access (user_id, company_id, created_by)
SELECT ur.user_id, c.company_id, ur.user_id
  FROM public.user_roles ur
 CROSS JOIN (VALUES (1::smallint), (3::smallint)) AS c(company_id)
 WHERE ur.role = 'admin'
ON CONFLICT DO NOTHING;
