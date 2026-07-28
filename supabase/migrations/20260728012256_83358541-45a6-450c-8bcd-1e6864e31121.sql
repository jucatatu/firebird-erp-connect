-- 1) Colunas de conclusão em operation_states
ALTER TABLE public.operation_states
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_by uuid,
  ADD COLUMN IF NOT EXISTS pickup_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_completed_by uuid;

-- Backfill a partir dos eventos imutáveis já existentes
UPDATE public.operation_states s
SET delivered_at = e.created_at, delivered_by = e.actor_id
FROM (
  SELECT DISTINCT ON (operation_state_id) operation_state_id, created_at, actor_id
  FROM public.operation_events
  WHERE event_type IN ('delivery_confirmed','delivered')
  ORDER BY operation_state_id, created_at ASC
) e
WHERE e.operation_state_id = s.id AND s.delivered_at IS NULL;

UPDATE public.operation_states s
SET pickup_completed_at = e.created_at, pickup_completed_by = e.actor_id
FROM (
  SELECT DISTINCT ON (operation_state_id) operation_state_id, created_at, actor_id
  FROM public.operation_events
  WHERE event_type IN ('pickup_confirmed','collected')
  ORDER BY operation_state_id, created_at ASC
) e
WHERE e.operation_state_id = s.id AND s.pickup_completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_operation_states_delivered_at ON public.operation_states (delivered_at);
CREATE INDEX IF NOT EXISTS idx_operation_states_pickup_completed_at ON public.operation_states (pickup_completed_at);

-- 2) Preenchimento automático na RPC de transição
CREATE OR REPLACE FUNCTION public.apply_operation_transition(_state_id uuid, _action text, _expected_version integer, _payload jsonb DEFAULT '{}'::jsonb)
 RETURNS operation_states
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.operation_states;
  v_old public.operational_status;
  v_new public.operational_status;
  v_has_pickup boolean;
  v_note text;
  v_reason text;
  v_event public.operation_event_type;
  v_extra jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_row FROM public.operation_states WHERE id=_state_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_state_not_found' USING ERRCODE='P0002'; END IF;
  IF NOT public.has_company_access(auth.uid(), v_row.company_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_row.version <> _expected_version THEN
    RAISE EXCEPTION 'operation_state_conflict' USING ERRCODE='P0004';
  END IF;

  v_old := v_row.operational_status;
  v_has_pickup := COALESCE(v_row.has_returnable_equipment, false);
  v_note := _payload->>'note';
  v_reason := _payload->>'reason';

  CASE _action
    WHEN 'start_delivery' THEN
      IF v_old NOT IN ('pending','rescheduled','not_found') THEN
        RAISE EXCEPTION 'invalid_transition' USING ERRCODE='22023', DETAIL='start_delivery from '||v_old;
      END IF;
      v_new := 'in_progress'; v_event := 'delivery_started';

    WHEN 'confirm_delivery' THEN
      IF v_old <> 'in_progress' THEN
        RAISE EXCEPTION 'invalid_transition' USING ERRCODE='22023', DETAIL='confirm_delivery requires in_progress';
      END IF;
      IF v_has_pickup THEN
        v_new := 'awaiting_pickup_definition';
      ELSE
        v_new := 'delivered';
      END IF;
      v_event := 'delivery_confirmed';

    WHEN 'delivery_not_found' THEN
      IF v_old NOT IN ('pending','in_progress','rescheduled') THEN
        RAISE EXCEPTION 'invalid_transition' USING ERRCODE='22023', DETAIL='delivery_not_found from '||v_old;
      END IF;
      v_new := 'not_found'; v_event := 'delivery_customer_not_found';

    WHEN 'reschedule_delivery' THEN
      IF v_old IN ('delivered','pickup_completed','collected') THEN
        RAISE EXCEPTION 'invalid_transition' USING ERRCODE='22023', DETAIL='cannot reschedule completed';
      END IF;
      IF v_reason IS NULL OR btrim(v_reason)='' THEN
        RAISE EXCEPTION 'reschedule_reason_required' USING ERRCODE='22023';
      END IF;
      v_new := 'rescheduled'; v_event := 'delivery_rescheduled';
      v_extra := jsonb_build_object('newDate', _payload->>'newDate', 'reason', v_reason);

    WHEN 'customer_will_contact' THEN
      IF v_old <> 'awaiting_pickup_definition' THEN
        RAISE EXCEPTION 'invalid_transition' USING ERRCODE='22023', DETAIL='customer_will_contact requires awaiting_pickup_definition';
      END IF;
      v_new := 'awaiting_customer_contact'; v_event := 'customer_will_contact';

    WHEN 'schedule_pickup' THEN
      IF v_old NOT IN ('awaiting_pickup_definition','awaiting_customer_contact','pickup_scheduled') THEN
        RAISE EXCEPTION 'invalid_transition' USING ERRCODE='22023', DETAIL='schedule_pickup from '||v_old;
      END IF;
      IF (_payload->>'scheduledDate') IS NULL OR btrim(_payload->>'scheduledDate')='' THEN
        RAISE EXCEPTION 'scheduled_date_required' USING ERRCODE='22023';
      END IF;
      v_new := 'pickup_scheduled';
      v_event := CASE WHEN v_old='pickup_scheduled' THEN 'pickup_rescheduled' ELSE 'pickup_scheduled' END;
      v_extra := jsonb_build_object(
        'previousDate', v_row.pickup_scheduled_date,
        'scheduledDate', _payload->>'scheduledDate',
        'scheduledTime', _payload->>'scheduledTime'
      );

    WHEN 'start_pickup' THEN
      IF v_old <> 'pickup_scheduled' THEN
        RAISE EXCEPTION 'invalid_transition' USING ERRCODE='22023', DETAIL='start_pickup requires pickup_scheduled';
      END IF;
      v_new := 'pickup_in_progress'; v_event := 'pickup_started';

    WHEN 'confirm_pickup' THEN
      IF v_old <> 'pickup_in_progress' THEN
        RAISE EXCEPTION 'invalid_transition' USING ERRCODE='22023', DETAIL='confirm_pickup requires pickup_in_progress';
      END IF;
      v_new := 'pickup_completed'; v_event := 'pickup_confirmed';

    WHEN 'pickup_not_found' THEN
      IF v_old NOT IN ('pickup_scheduled','pickup_in_progress') THEN
        RAISE EXCEPTION 'invalid_transition' USING ERRCODE='22023', DETAIL='pickup_not_found from '||v_old;
      END IF;
      v_new := 'not_found'; v_event := 'pickup_customer_not_found';

    ELSE
      RAISE EXCEPTION 'unknown_action' USING ERRCODE='22023', DETAIL=_action;
  END CASE;

  UPDATE public.operation_states
    SET operational_status = v_new,
        operational_date = CASE
          WHEN _action='reschedule_delivery' AND (_payload->>'newDate') IS NOT NULL
            THEN (_payload->>'newDate')::date
          ELSE operational_date
        END,
        reschedule_reason = CASE WHEN _action='reschedule_delivery' THEN v_reason ELSE reschedule_reason END,
        pickup_scheduled_date = CASE
          WHEN _action='schedule_pickup' THEN (_payload->>'scheduledDate')::date
          ELSE pickup_scheduled_date
        END,
        pickup_scheduled_time = CASE
          WHEN _action='schedule_pickup' THEN NULLIF(_payload->>'scheduledTime','')
          ELSE pickup_scheduled_time
        END,
        pickup_note = CASE
          WHEN _action IN ('schedule_pickup','customer_will_contact') AND v_note IS NOT NULL AND btrim(v_note)<>''
            THEN v_note
          ELSE pickup_note
        END,
        -- Carimbos permanentes: gravados apenas na primeira conclusão (nunca sobrescritos)
        delivered_at = CASE WHEN _action='confirm_delivery' AND delivered_at IS NULL THEN now() ELSE delivered_at END,
        delivered_by = CASE WHEN _action='confirm_delivery' AND delivered_by IS NULL THEN auth.uid() ELSE delivered_by END,
        pickup_completed_at = CASE WHEN _action='confirm_pickup' AND pickup_completed_at IS NULL THEN now() ELSE pickup_completed_at END,
        pickup_completed_by = CASE WHEN _action='confirm_pickup' AND pickup_completed_by IS NULL THEN auth.uid() ELSE pickup_completed_by END,
        updated_by = auth.uid(),
        version = version + 1
    WHERE id = _state_id
    RETURNING * INTO v_row;

  INSERT INTO public.operation_events(operation_state_id,event_type,description,actor_id,origin,metadata)
  VALUES (
    _state_id, v_event,
    CASE WHEN v_note IS NOT NULL AND btrim(v_note)<>'' THEN v_note ELSE NULL END,
    auth.uid(), 'local',
    v_extra || jsonb_build_object('from', v_old, 'to', v_new)
  );

  IF v_new IN ('delivered','pickup_completed') THEN
    INSERT INTO public.operation_events(operation_state_id,event_type,description,actor_id,origin,metadata)
    VALUES (_state_id,'operation_completed',NULL,auth.uid(),'local','{}'::jsonb);
  END IF;

  RETURN v_row;
END;
$function$;

-- 3) Configurações globais da operação
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings: autenticado lê" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "app_settings: admin insere" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "app_settings: admin atualiza" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER app_settings_set_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_settings (key, value)
VALUES ('map_completed_window_days', '{"days": 7}'::jsonb)
ON CONFLICT (key) DO NOTHING;