
-- 1) Novos valores do enum operational_status (preservando existentes)
ALTER TYPE operational_status ADD VALUE IF NOT EXISTS 'awaiting_pickup_definition';
ALTER TYPE operational_status ADD VALUE IF NOT EXISTS 'awaiting_customer_contact';
ALTER TYPE operational_status ADD VALUE IF NOT EXISTS 'pickup_scheduled';
ALTER TYPE operational_status ADD VALUE IF NOT EXISTS 'pickup_in_progress';
ALTER TYPE operational_status ADD VALUE IF NOT EXISTS 'pickup_completed';

-- 2) Novos tipos de evento
ALTER TYPE operation_event_type ADD VALUE IF NOT EXISTS 'delivery_assigned';
ALTER TYPE operation_event_type ADD VALUE IF NOT EXISTS 'delivery_assignee_changed';
ALTER TYPE operation_event_type ADD VALUE IF NOT EXISTS 'delivery_started';
ALTER TYPE operation_event_type ADD VALUE IF NOT EXISTS 'delivery_confirmed';
ALTER TYPE operation_event_type ADD VALUE IF NOT EXISTS 'delivery_customer_not_found';
ALTER TYPE operation_event_type ADD VALUE IF NOT EXISTS 'delivery_rescheduled';
ALTER TYPE operation_event_type ADD VALUE IF NOT EXISTS 'customer_will_contact';
ALTER TYPE operation_event_type ADD VALUE IF NOT EXISTS 'pickup_scheduled';
ALTER TYPE operation_event_type ADD VALUE IF NOT EXISTS 'pickup_rescheduled';
ALTER TYPE operation_event_type ADD VALUE IF NOT EXISTS 'pickup_assigned';
ALTER TYPE operation_event_type ADD VALUE IF NOT EXISTS 'pickup_assignee_changed';
ALTER TYPE operation_event_type ADD VALUE IF NOT EXISTS 'pickup_started';
ALTER TYPE operation_event_type ADD VALUE IF NOT EXISTS 'pickup_customer_not_found';
ALTER TYPE operation_event_type ADD VALUE IF NOT EXISTS 'pickup_confirmed';
ALTER TYPE operation_event_type ADD VALUE IF NOT EXISTS 'operation_completed';

-- 3) Novas colunas em operation_states
ALTER TABLE public.operation_states
  ADD COLUMN IF NOT EXISTS has_returnable_equipment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_assigned_by uuid,
  ADD COLUMN IF NOT EXISTS pickup_assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pickup_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_assigned_by uuid,
  ADD COLUMN IF NOT EXISTS pickup_scheduled_date date,
  ADD COLUMN IF NOT EXISTS pickup_scheduled_time text,
  ADD COLUMN IF NOT EXISTS pickup_note text;

-- 4) Grant leitura de profiles (para o seletor de responsável) já é authenticated (default select)?
GRANT SELECT ON public.profiles TO authenticated;

-- 5) RPC: atribuir/alterar operador de entrega ou recolhimento
CREATE OR REPLACE FUNCTION public.assign_operation_operator(
  _state_id uuid,
  _role text, -- 'delivery' | 'pickup'
  _user_id uuid,
  _expected_version integer
) RETURNS public.operation_states
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.operation_states;
  v_prev uuid;
  v_event public.operation_event_type;
  v_changed_event public.operation_event_type;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501';
  END IF;
  IF _role NOT IN ('delivery','pickup') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_row FROM public.operation_states WHERE id=_state_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation_state_not_found' USING ERRCODE='P0002'; END IF;
  IF NOT public.has_company_access(auth.uid(), v_row.company_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_row.version <> _expected_version THEN
    RAISE EXCEPTION 'operation_state_conflict' USING ERRCODE='P0004';
  END IF;

  IF _role='delivery' THEN
    v_prev := v_row.delivery_assignee_id;
    v_event := 'delivery_assigned';
    v_changed_event := 'delivery_assignee_changed';
    UPDATE public.operation_states
      SET delivery_assignee_id=_user_id,
          delivery_assigned_at=now(),
          delivery_assigned_by=auth.uid(),
          updated_by=auth.uid(),
          version=version+1
      WHERE id=_state_id
      RETURNING * INTO v_row;
  ELSE
    v_prev := v_row.pickup_assignee_id;
    v_event := 'pickup_assigned';
    v_changed_event := 'pickup_assignee_changed';
    UPDATE public.operation_states
      SET pickup_assignee_id=_user_id,
          pickup_assigned_at=now(),
          pickup_assigned_by=auth.uid(),
          updated_by=auth.uid(),
          version=version+1
      WHERE id=_state_id
      RETURNING * INTO v_row;
  END IF;

  INSERT INTO public.operation_events(operation_state_id,event_type,description,actor_id,origin,metadata)
  VALUES (
    _state_id,
    CASE WHEN v_prev IS NULL THEN v_event ELSE v_changed_event END,
    NULL, auth.uid(), 'local',
    jsonb_build_object('previous', v_prev, 'new', _user_id, 'role', _role)
  );

  RETURN v_row;
END;
$$;

-- 6) RPC central de transição
CREATE OR REPLACE FUNCTION public.apply_operation_transition(
  _state_id uuid,
  _action text,
  _expected_version integer,
  _payload jsonb DEFAULT '{}'::jsonb
) RETURNS public.operation_states
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Máquina de transição
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

  -- Update
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
        updated_by = auth.uid(),
        version = version + 1
    WHERE id = _state_id
    RETURNING * INTO v_row;

  -- Evento principal
  INSERT INTO public.operation_events(operation_state_id,event_type,description,actor_id,origin,metadata)
  VALUES (
    _state_id, v_event,
    CASE WHEN v_note IS NOT NULL AND btrim(v_note)<>'' THEN v_note ELSE NULL END,
    auth.uid(), 'local',
    v_extra || jsonb_build_object('from', v_old, 'to', v_new)
  );

  -- Evento de conclusão quando aplicável
  IF v_new IN ('delivered','pickup_completed') THEN
    INSERT INTO public.operation_events(operation_state_id,event_type,description,actor_id,origin,metadata)
    VALUES (_state_id,'operation_completed',NULL,auth.uid(),'local','{}'::jsonb);
  END IF;

  RETURN v_row;
END;
$$;
