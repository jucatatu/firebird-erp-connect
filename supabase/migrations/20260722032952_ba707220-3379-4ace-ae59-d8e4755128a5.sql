
-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor', 'aprovador');

CREATE TYPE public.order_draft_status AS ENUM (
  'draft', 'pending_approval', 'approved', 'rejected',
  'sending', 'sent', 'send_failed', 'cancelled'
);

-- ========== UTILITY: updated_at ==========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== USER_ROLES ==========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ========== has_role ==========
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- ========== PROFILE AUTOCREATE ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      NEW.email
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== PROFILES POLICIES ==========
CREATE POLICY "profiles: usuário lê o próprio"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "profiles: admin lê todos"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "profiles: usuário atualiza o próprio (sem alterar active)"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid() AND active = (SELECT active FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "profiles: admin atualiza qualquer"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "profiles: admin insere"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========== USER_ROLES POLICIES ==========
CREATE POLICY "user_roles: usuário lê próprios papéis"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "user_roles: admin lê todos"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles: admin insere"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles: admin atualiza"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles: admin remove"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ========== ORDER_DRAFTS ==========
CREATE TABLE public.order_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  status public.order_draft_status NOT NULL DEFAULT 'draft',
  title TEXT,
  customer_name_snapshot TEXT,
  company_id INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key UUID NOT NULL DEFAULT gen_random_uuid(),
  erp_order_id INTEGER,
  erp_order_number INTEGER,
  send_attempts INTEGER NOT NULL DEFAULT 0,
  last_send_error TEXT,
  sent_at TIMESTAMPTZ,
  rejection_reason TEXT,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_drafts_company_id_check CHECK (company_id IS NULL OR company_id IN (1, 3)),
  CONSTRAINT order_drafts_send_attempts_check CHECK (send_attempts >= 0),
  CONSTRAINT order_drafts_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE UNIQUE INDEX order_drafts_erp_order_id_uniq
  ON public.order_drafts (erp_order_id) WHERE erp_order_id IS NOT NULL;
CREATE UNIQUE INDEX order_drafts_erp_order_number_uniq
  ON public.order_drafts (erp_order_number) WHERE erp_order_number IS NOT NULL;
CREATE INDEX order_drafts_created_by_idx ON public.order_drafts (created_by);
CREATE INDEX order_drafts_status_idx ON public.order_drafts (status);
CREATE INDEX order_drafts_updated_at_idx ON public.order_drafts (updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_drafts TO authenticated;
GRANT ALL ON public.order_drafts TO service_role;

ALTER TABLE public.order_drafts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_order_drafts_updated_at
BEFORE UPDATE ON public.order_drafts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== ORDER_DRAFTS POLICIES ==========
-- SELECT
CREATE POLICY "order_drafts: admin lê tudo"
ON public.order_drafts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "order_drafts: aprovador lê tudo"
ON public.order_drafts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'aprovador'));

CREATE POLICY "order_drafts: vendedor lê os próprios"
ON public.order_drafts FOR SELECT TO authenticated
USING (created_by = auth.uid() AND public.has_role(auth.uid(), 'vendedor'));

-- INSERT: vendedor ou admin, sempre em nome próprio, status inicial draft
CREATE POLICY "order_drafts: vendedor cria próprio"
ON public.order_drafts FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND updated_by = auth.uid()
  AND status = 'draft'
  AND public.has_role(auth.uid(), 'vendedor')
);

CREATE POLICY "order_drafts: admin cria em nome próprio"
ON public.order_drafts FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND updated_by = auth.uid()
  AND public.has_role(auth.uid(), 'admin')
);

-- UPDATE: vendedor edita próprio em draft/rejected/send_failed,
-- SEM mudar status ou campos sensíveis por UPDATE direto (transições via RPC)
CREATE POLICY "order_drafts: vendedor edita próprio editável"
ON public.order_drafts FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  AND public.has_role(auth.uid(), 'vendedor')
  AND status IN ('draft', 'rejected', 'send_failed')
)
WITH CHECK (
  created_by = auth.uid()
  AND updated_by = auth.uid()
  AND status IN ('draft', 'rejected', 'send_failed')
);

CREATE POLICY "order_drafts: admin edita tudo"
ON public.order_drafts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- DELETE bloqueado por padrão (sem política); admin pode via service_role/painel.

-- ========== ORDER_DRAFT_EVENTS ==========
CREATE TABLE public.order_draft_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_draft_id UUID NOT NULL REFERENCES public.order_drafts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_status public.order_draft_status,
  new_status public.order_draft_status,
  actor_id UUID REFERENCES auth.users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX order_draft_events_draft_idx ON public.order_draft_events (order_draft_id, created_at);

GRANT SELECT ON public.order_draft_events TO authenticated;
GRANT ALL ON public.order_draft_events TO service_role;

ALTER TABLE public.order_draft_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_draft_events: leitura conforme rascunho"
ON public.order_draft_events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.order_drafts d
    WHERE d.id = order_draft_events.order_draft_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'aprovador')
        OR (d.created_by = auth.uid() AND public.has_role(auth.uid(), 'vendedor'))
      )
  )
);
-- Sem policies de INSERT/UPDATE/DELETE: apenas triggers SECURITY DEFINER escrevem aqui.

-- ========== TRIGGERS DE EVENTOS ==========
CREATE OR REPLACE FUNCTION public.log_order_draft_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.order_draft_events (order_draft_id, event_type, previous_status, new_status, actor_id)
  VALUES (NEW.id, 'DRAFT_CREATED', NULL, NEW.status, NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_drafts_insert_event
AFTER INSERT ON public.order_drafts
FOR EACH ROW EXECUTE FUNCTION public.log_order_draft_insert();

CREATE OR REPLACE FUNCTION public.log_order_draft_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_draft_events (order_draft_id, event_type, previous_status, new_status, actor_id, metadata)
    VALUES (
      NEW.id,
      'STATUS_CHANGED',
      OLD.status,
      NEW.status,
      COALESCE(auth.uid(), NEW.updated_by),
      CASE WHEN NEW.rejection_reason IS NOT NULL AND NEW.status = 'rejected'
           THEN jsonb_build_object('reason', NEW.rejection_reason)
           ELSE '{}'::jsonb END
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_drafts_status_change_event
AFTER UPDATE OF status ON public.order_drafts
FOR EACH ROW EXECUTE FUNCTION public.log_order_draft_status_change();

-- ========== RPC: update_order_draft_status ==========
CREATE OR REPLACE FUNCTION public.update_order_draft_status(
  _draft_id UUID,
  _new_status public.order_draft_status,
  _reason TEXT DEFAULT NULL
)
RETURNS public.order_drafts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_draft public.order_drafts;
  v_is_admin BOOLEAN;
  v_is_approver BOOLEAN;
  v_is_seller BOOLEAN;
  v_is_owner BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_draft FROM public.order_drafts WHERE id = _draft_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rascunho não encontrado' USING ERRCODE = 'P0002';
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin');
  v_is_approver := public.has_role(v_uid, 'aprovador');
  v_is_seller := public.has_role(v_uid, 'vendedor');
  v_is_owner := (v_draft.created_by = v_uid);

  -- Transições permitidas
  IF NOT (
    (v_draft.status = 'draft' AND _new_status = 'pending_approval' AND (v_is_owner OR v_is_admin))
    OR (v_draft.status = 'rejected' AND _new_status = 'draft' AND (v_is_owner OR v_is_admin))
    OR (v_draft.status = 'send_failed' AND _new_status = 'draft' AND (v_is_owner OR v_is_admin))
    OR (v_draft.status = 'pending_approval' AND _new_status = 'approved' AND (v_is_approver OR v_is_admin))
    OR (v_draft.status = 'pending_approval' AND _new_status = 'rejected' AND (v_is_approver OR v_is_admin))
    OR (v_draft.status = 'approved' AND _new_status = 'cancelled' AND v_is_admin)
    OR (v_draft.status = 'draft' AND _new_status = 'cancelled' AND (v_is_owner OR v_is_admin))
    OR (v_draft.status = 'rejected' AND _new_status = 'cancelled' AND (v_is_owner OR v_is_admin))
  ) THEN
    RAISE EXCEPTION 'Transição não permitida: % -> % para este usuário', v_draft.status, _new_status
      USING ERRCODE = '42501';
  END IF;

  -- Regra: aprovador não pode aprovar o próprio pedido
  IF _new_status = 'approved' AND v_is_owner AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Você não pode aprovar seu próprio pedido' USING ERRCODE = '42501';
  END IF;

  IF _new_status = 'rejected' THEN
    IF _reason IS NULL OR btrim(_reason) = '' THEN
      RAISE EXCEPTION 'Motivo obrigatório para rejeição' USING ERRCODE = '22023';
    END IF;
    UPDATE public.order_drafts
      SET status = _new_status,
          rejection_reason = _reason,
          rejected_at = now(),
          rejected_by = v_uid,
          updated_by = v_uid
      WHERE id = _draft_id
      RETURNING * INTO v_draft;
  ELSIF _new_status = 'draft' THEN
    UPDATE public.order_drafts
      SET status = _new_status,
          rejection_reason = NULL,
          rejected_at = NULL,
          rejected_by = NULL,
          last_send_error = NULL,
          updated_by = v_uid
      WHERE id = _draft_id
      RETURNING * INTO v_draft;
  ELSE
    UPDATE public.order_drafts
      SET status = _new_status,
          updated_by = v_uid
      WHERE id = _draft_id
      RETURNING * INTO v_draft;
  END IF;

  RETURN v_draft;
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_draft_status(UUID, public.order_draft_status, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_draft_status(UUID, public.order_draft_status, TEXT) TO authenticated;
