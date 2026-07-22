
-- Enums
CREATE TYPE public.operational_status AS ENUM (
  'pending','in_progress','delivered','collected','customer_will_call','not_found','rescheduled'
);
CREATE TYPE public.operation_event_type AS ENUM (
  'loaded','started','note_added','rescheduled','customer_will_call','delivered','collected','not_found','corrected'
);
CREATE TYPE public.operation_event_origin AS ENUM ('local','erp');

-- operation_states
CREATE TABLE public.operation_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_order_id bigint NOT NULL,
  erp_order_number integer,
  company_id smallint,
  operation_date date NOT NULL,
  operational_date date,
  operational_status public.operational_status NOT NULL DEFAULT 'pending',
  sequence integer,
  reschedule_reason text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operation_date, erp_order_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operation_states TO authenticated;
GRANT ALL ON public.operation_states TO service_role;
ALTER TABLE public.operation_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "states_select_own_or_privileged" ON public.operation_states
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'aprovador')
  );
CREATE POLICY "states_insert_authenticated" ON public.operation_states
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "states_update_own_or_privileged" ON public.operation_states
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'aprovador')
  )
  WITH CHECK (true);
CREATE POLICY "states_delete_admin" ON public.operation_states
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_operation_states_updated_at
  BEFORE UPDATE ON public.operation_states
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- operation_events (append-only)
CREATE TABLE public.operation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_state_id uuid NOT NULL REFERENCES public.operation_states(id) ON DELETE CASCADE,
  event_type public.operation_event_type NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid DEFAULT auth.uid(),
  origin public.operation_event_origin NOT NULL DEFAULT 'local',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.operation_events TO authenticated;
GRANT ALL ON public.operation_events TO service_role;
ALTER TABLE public.operation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select_via_state" ON public.operation_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.operation_states s
    WHERE s.id = operation_state_id
      AND (s.created_by = auth.uid()
           OR public.has_role(auth.uid(),'admin')
           OR public.has_role(auth.uid(),'aprovador'))
  ));
CREATE POLICY "events_insert_via_state" ON public.operation_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.operation_states s
    WHERE s.id = operation_state_id
      AND (s.created_by = auth.uid()
           OR public.has_role(auth.uid(),'admin')
           OR public.has_role(auth.uid(),'aprovador'))
  ));
-- No UPDATE/DELETE policies -> append-only for everyone (RLS default deny).

-- operation_notes
CREATE TABLE public.operation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_state_id uuid NOT NULL REFERENCES public.operation_states(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.operation_notes TO authenticated;
GRANT ALL ON public.operation_notes TO service_role;
ALTER TABLE public.operation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_select_via_state" ON public.operation_notes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.operation_states s
    WHERE s.id = operation_state_id
      AND (s.created_by = auth.uid()
           OR public.has_role(auth.uid(),'admin')
           OR public.has_role(auth.uid(),'aprovador'))
  ));
CREATE POLICY "notes_insert_via_state" ON public.operation_notes
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.operation_states s
    WHERE s.id = operation_state_id
      AND (s.created_by = auth.uid()
           OR public.has_role(auth.uid(),'admin')
           OR public.has_role(auth.uid(),'aprovador'))
  ));

-- Auto-log status changes / creation
CREATE OR REPLACE FUNCTION public.log_operation_state_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.operation_events (operation_state_id, event_type, description, actor_id, origin)
  VALUES (NEW.id, 'loaded', 'Pedido carregado na operação', NEW.created_by, 'local');
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_operation_state_insert
  AFTER INSERT ON public.operation_states
  FOR EACH ROW EXECUTE FUNCTION public.log_operation_state_insert();

CREATE OR REPLACE FUNCTION public.log_operation_state_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type public.operation_event_type;
BEGIN
  IF NEW.operational_status IS DISTINCT FROM OLD.operational_status THEN
    v_type := CASE NEW.operational_status
      WHEN 'in_progress' THEN 'started'
      WHEN 'delivered' THEN 'delivered'
      WHEN 'collected' THEN 'collected'
      WHEN 'customer_will_call' THEN 'customer_will_call'
      WHEN 'not_found' THEN 'not_found'
      WHEN 'rescheduled' THEN 'rescheduled'
      ELSE NULL
    END;
    IF v_type IS NOT NULL THEN
      INSERT INTO public.operation_events (operation_state_id, event_type, description, metadata, actor_id, origin)
      VALUES (
        NEW.id, v_type, NULL,
        jsonb_build_object('from', OLD.operational_status, 'to', NEW.operational_status,
                           'reason', NEW.reschedule_reason),
        COALESCE(auth.uid(), NEW.updated_by), 'local'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_operation_state_status_change
  AFTER UPDATE ON public.operation_states
  FOR EACH ROW EXECUTE FUNCTION public.log_operation_state_status_change();

CREATE INDEX idx_operation_states_date ON public.operation_states(operation_date);
CREATE INDEX idx_operation_states_status ON public.operation_states(operational_status);
CREATE INDEX idx_operation_events_state ON public.operation_events(operation_state_id, created_at DESC);
CREATE INDEX idx_operation_notes_state ON public.operation_notes(operation_state_id, created_at DESC);
