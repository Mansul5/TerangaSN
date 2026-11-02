BEGIN;

CREATE TABLE public.subscription_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  target_plan_code text NOT NULL DEFAULT 'business'
    REFERENCES public.saas_plans(code) CHECK (target_plan_code = 'business'),
  reference text NOT NULL UNIQUE,
  amount_xof integer NOT NULL DEFAULT 39900 CHECK (amount_xof = 39900),
  proof_path text,
  status text NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN ('awaiting_payment', 'pending', 'approved', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  proof_submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_note text,
  CHECK ((status IN ('awaiting_payment', 'pending') AND reviewed_at IS NULL AND reviewed_by IS NULL)
      OR (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)),
  CHECK (status <> 'pending' OR (proof_path IS NOT NULL AND proof_submitted_at IS NOT NULL))
);
CREATE UNIQUE INDEX subscription_one_pending_change_per_owner
  ON public.subscription_change_requests(owner_id) WHERE status IN ('awaiting_payment', 'pending');

CREATE TABLE public.enterprise_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  contract_reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
  monthly_amount_xof integer NOT NULL CHECK (monthly_amount_xof >= 0),
  marketplace_commission_pct numeric(5,2) NOT NULL CHECK (marketplace_commission_pct BETWEEN 0 AND 100),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  terms text NOT NULL CHECK (char_length(btrim(terms)) BETWEEN 1 AND 10000),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE public.subscription_payment_instructions (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  account_holder text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  account_reference text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.subscription_payment_instructions (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  request_id uuid UNIQUE REFERENCES public.subscription_change_requests(id) ON DELETE RESTRICT,
  enterprise_contract_id uuid REFERENCES public.enterprise_contracts(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL UNIQUE,
  invoice_type text NOT NULL CHECK (invoice_type IN ('business_subscription', 'enterprise_contract')),
  amount_xof integer NOT NULL CHECK (amount_xof >= 0),
  status text NOT NULL CHECK (status IN ('paid', 'void')),
  description text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CHECK ((invoice_type = 'business_subscription' AND request_id IS NOT NULL AND enterprise_contract_id IS NULL)
      OR (invoice_type = 'enterprise_contract' AND request_id IS NULL AND enterprise_contract_id IS NOT NULL)),
  CHECK ((status = 'paid' AND paid_at IS NOT NULL) OR (status = 'void' AND paid_at IS NULL))
);

CREATE TABLE public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  request_id uuid UNIQUE REFERENCES public.subscription_change_requests(id) ON DELETE RESTRICT,
  enterprise_contract_id uuid REFERENCES public.enterprise_contracts(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL UNIQUE REFERENCES public.subscription_invoices(id) ON DELETE RESTRICT,
  amount_xof integer NOT NULL CHECK (amount_xof >= 0),
  payment_reference text NOT NULL UNIQUE,
  proof_path text,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CHECK ((request_id IS NOT NULL AND enterprise_contract_id IS NULL)
      OR (request_id IS NULL AND enterprise_contract_id IS NOT NULL))
);

CREATE TABLE public.subscription_plan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  previous_plan_code text REFERENCES public.saas_plans(code),
  new_plan_code text NOT NULL REFERENCES public.saas_plans(code),
  effective_at timestamptz NOT NULL DEFAULT now(),
  period_end timestamptz,
  change_type text NOT NULL CHECK (change_type IN ('initial', 'business_payment', 'enterprise_contract')),
  request_id uuid REFERENCES public.subscription_change_requests(id) ON DELETE RESTRICT,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  note text
);
CREATE INDEX subscription_history_owner_date_idx
  ON public.subscription_plan_history(owner_id, effective_at DESC);
CREATE INDEX subscription_invoice_paid_date_idx
  ON public.subscription_invoices(paid_at DESC) WHERE status = 'paid';

INSERT INTO public.subscription_plan_history
  (owner_id, previous_plan_code, new_plan_code, effective_at, period_end, change_type, note)
SELECT owner_id, NULL, plan_code, current_period_start, current_period_end, 'initial',
       'État initial au déploiement de l’historique des abonnements.'
FROM public.owner_subscriptions;

ALTER TABLE public.subscription_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payment_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_requests_owner_or_finance_read
  ON public.subscription_change_requests FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR (SELECT public.has_admin_permission('finance')));
CREATE POLICY enterprise_contract_owner_or_finance_read
  ON public.enterprise_contracts FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR (SELECT public.has_admin_permission('finance')));
CREATE POLICY subscription_payment_instructions_authenticated_read
  ON public.subscription_payment_instructions FOR SELECT TO authenticated
  USING (true);
CREATE POLICY subscription_invoices_owner_or_finance_read
  ON public.subscription_invoices FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR (SELECT public.has_admin_permission('finance')));
CREATE POLICY subscription_payments_owner_or_finance_read
  ON public.subscription_payments FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR (SELECT public.has_admin_permission('finance')));
CREATE POLICY subscription_history_owner_or_finance_read
  ON public.subscription_plan_history FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR (SELECT public.has_admin_permission('finance')));

REVOKE ALL ON public.subscription_change_requests, public.enterprise_contracts,
  public.subscription_invoices, public.subscription_payments,
  public.subscription_plan_history, public.subscription_payment_instructions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.subscription_change_requests, public.enterprise_contracts,
  public.subscription_invoices, public.subscription_payments,
  public.subscription_plan_history, public.subscription_payment_instructions
  TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('subscription-proofs', 'subscription-proofs', false, 5242880,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

CREATE POLICY subscription_proofs_owner_upload
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'subscription-proofs'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
CREATE POLICY subscription_proofs_owner_or_finance_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'subscription-proofs'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR (SELECT public.has_admin_permission('finance'))
    )
  );
CREATE POLICY subscription_proofs_owner_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'subscription-proofs'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND NOT EXISTS (
      SELECT 1 FROM public.subscription_change_requests change_request
      WHERE change_request.proof_path = name
    )
  );

CREATE OR REPLACE FUNCTION public.request_business_subscription()
RETURNS TABLE(request_id uuid, request_reference text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reference text;
  v_request_id uuid;
  v_subscription public.owner_subscriptions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_subscription
  FROM public.owner_subscriptions WHERE owner_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abonnement hôte introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_subscription.plan_code = 'enterprise' THEN
    RAISE EXCEPTION 'Votre contrat Enterprise doit être géré par votre interlocuteur TerangaSN'
      USING ERRCODE = '22023';
  END IF;
  IF v_subscription.plan_code = 'business' AND v_subscription.status = 'active'
     AND v_subscription.current_period_end > now() THEN
    RAISE EXCEPTION 'La formule Business est déjà active' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.subscription_change_requests
    WHERE owner_id = v_uid AND status IN ('awaiting_payment', 'pending')
  ) THEN
    RAISE EXCEPTION 'Une demande Business est déjà en cours' USING ERRCODE = '23505';
  END IF;

  v_reference := 'TSN-BIZ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  INSERT INTO public.subscription_change_requests (owner_id, reference)
  VALUES (v_uid, v_reference)
  RETURNING id INTO v_request_id;
  RETURN QUERY SELECT v_request_id, v_reference;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_business_subscription_proof(
  p_request_id uuid,
  p_proof_path text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  IF p_proof_path IS NULL OR char_length(p_proof_path) > 500
     OR (storage.foldername(p_proof_path))[1] IS DISTINCT FROM v_uid::text
     OR NOT EXISTS (
       SELECT 1 FROM storage.objects
       WHERE bucket_id = 'subscription-proofs' AND name = p_proof_path
     ) THEN
    RAISE EXCEPTION 'Justificatif introuvable ou invalide' USING ERRCODE = '22023';
  END IF;
  UPDATE public.subscription_change_requests
  SET proof_path = p_proof_path, proof_submitted_at = now(), status = 'pending'
  WHERE id = p_request_id AND owner_id = v_uid AND status = 'awaiting_payment';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande de paiement introuvable ou déjà transmise' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_business_subscription(
  p_request_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_request public.subscription_change_requests%ROWTYPE;
  v_old_plan text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_invoice_id uuid;
BEGIN
  IF NOT coalesce((SELECT public.has_admin_permission('finance')), false) THEN
    RAISE EXCEPTION 'Permission finance requise' USING ERRCODE = '42501';
  END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 2000 THEN
    RAISE EXCEPTION 'La note ne peut pas dépasser 2000 caractères' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_request FROM public.subscription_change_requests
  WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Demande introuvable ou déjà traitée' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.subscription_change_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_at = now(), reviewed_by = (SELECT auth.uid()),
      review_note = NULLIF(btrim(p_note), '')
  WHERE id = p_request_id;

  IF NOT p_approve THEN
    RETURN;
  END IF;

  SELECT plan_code INTO v_old_plan
  FROM public.owner_subscriptions WHERE owner_id = v_request.owner_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abonnement hôte introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_old_plan = 'enterprise' THEN
    RAISE EXCEPTION 'Le compte dispose déjà d’un contrat Enterprise' USING ERRCODE = '22023';
  END IF;
  v_period_start := now();
  v_period_end := v_period_start + interval '1 month';

  UPDATE public.owner_subscriptions
  SET plan_code = 'business', status = 'active',
      current_period_start = v_period_start, current_period_end = v_period_end,
      custom_marketplace_commission_pct = NULL,
      custom_max_active_lodgings = NULL, custom_max_collaborators = NULL,
      updated_at = now()
  WHERE owner_id = v_request.owner_id;

  INSERT INTO public.subscription_invoices
    (owner_id, request_id, invoice_number, invoice_type, amount_xof, status,
     description, paid_at, created_by)
  VALUES (
    v_request.owner_id, v_request.id,
    'TSN-F-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    'business_subscription', v_request.amount_xof, 'paid',
    'Abonnement Business — un mois', now(), (SELECT auth.uid())
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO public.subscription_payments
    (owner_id, request_id, invoice_id, amount_xof, payment_reference, proof_path, confirmed_by)
  VALUES
    (v_request.owner_id, v_request.id, v_invoice_id, v_request.amount_xof,
     v_request.reference, v_request.proof_path, (SELECT auth.uid()));

  INSERT INTO public.subscription_plan_history
    (owner_id, previous_plan_code, new_plan_code, effective_at, period_end,
     change_type, request_id, changed_by, note)
  VALUES
    (v_request.owner_id, v_old_plan, 'business', v_period_start, v_period_end,
     'business_payment', v_request.id, (SELECT auth.uid()),
     NULLIF(btrim(p_note), ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_enterprise_contract(
  p_owner_id uuid,
  p_monthly_amount_xof integer,
  p_marketplace_commission_pct numeric,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_terms text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_contract_id uuid;
  v_old_plan text;
  v_reference text;
BEGIN
  IF NOT coalesce((SELECT public.has_admin_permission('finance')), false) THEN
    RAISE EXCEPTION 'Permission finance requise' USING ERRCODE = '42501';
  END IF;
  IF p_monthly_amount_xof IS NULL OR p_monthly_amount_xof < 0
     OR p_marketplace_commission_pct IS NULL
     OR p_marketplace_commission_pct NOT BETWEEN 0 AND 100
     OR p_starts_at IS NULL OR p_starts_at > now()
     OR (p_ends_at IS NOT NULL AND p_ends_at <= p_starts_at)
     OR p_terms IS NULL OR char_length(btrim(p_terms)) NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'Informations du contrat invalides' USING ERRCODE = '22023';
  END IF;
  SELECT plan_code INTO v_old_plan FROM public.owner_subscriptions
  WHERE owner_id = p_owner_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abonnement hôte introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.subscription_change_requests
    WHERE owner_id = p_owner_id AND status IN ('awaiting_payment', 'pending')
  ) THEN
    RAISE EXCEPTION 'Traitez la demande Business en attente avant de créer un contrat Enterprise'
      USING ERRCODE = '22023';
  END IF;
  v_reference := 'TSN-ENT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  INSERT INTO public.enterprise_contracts
    (owner_id, contract_reference, monthly_amount_xof, marketplace_commission_pct,
     starts_at, ends_at, terms, created_by)
  VALUES
    (p_owner_id, v_reference, p_monthly_amount_xof, p_marketplace_commission_pct,
     p_starts_at, p_ends_at, btrim(p_terms), (SELECT auth.uid()))
  RETURNING id INTO v_contract_id;

  UPDATE public.owner_subscriptions
  SET plan_code = 'enterprise', status = 'active',
      current_period_start = p_starts_at, current_period_end = p_ends_at,
      custom_marketplace_commission_pct = p_marketplace_commission_pct,
      custom_max_active_lodgings = NULL, custom_max_collaborators = NULL,
      updated_at = now()
  WHERE owner_id = p_owner_id;

  INSERT INTO public.subscription_plan_history
    (owner_id, previous_plan_code, new_plan_code, effective_at, period_end,
     change_type, changed_by, note)
  VALUES
    (p_owner_id, v_old_plan, 'enterprise', p_starts_at, p_ends_at,
     'enterprise_contract', (SELECT auth.uid()), v_reference);
  RETURN v_contract_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_record_enterprise_payment(
  p_contract_id uuid,
  p_amount_xof integer,
  p_payment_reference text,
  p_paid_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_contract public.enterprise_contracts%ROWTYPE;
  v_invoice_id uuid;
BEGIN
  IF NOT coalesce((SELECT public.has_admin_permission('finance')), false) THEN
    RAISE EXCEPTION 'Permission finance requise' USING ERRCODE = '42501';
  END IF;
  IF p_amount_xof IS NULL OR p_amount_xof <= 0
     OR p_payment_reference IS NULL OR char_length(btrim(p_payment_reference)) NOT BETWEEN 1 AND 160
     OR p_paid_at IS NULL OR p_paid_at > now() THEN
    RAISE EXCEPTION 'Informations de paiement invalides' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_contract FROM public.enterprise_contracts
  WHERE id = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrat Enterprise introuvable' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.subscription_invoices
    (owner_id, enterprise_contract_id, invoice_number, invoice_type, amount_xof,
     status, description, paid_at, created_by)
  VALUES
    (v_contract.owner_id, v_contract.id,
     'TSN-F-' || to_char(p_paid_at, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
     'enterprise_contract', p_amount_xof, 'paid',
     'Règlement du contrat ' || v_contract.contract_reference, p_paid_at, (SELECT auth.uid()))
  RETURNING id INTO v_invoice_id;
  INSERT INTO public.subscription_payments
    (owner_id, enterprise_contract_id, invoice_id, amount_xof,
     payment_reference, confirmed_at, confirmed_by)
  VALUES
    (v_contract.owner_id, v_contract.id, v_invoice_id, p_amount_xof,
     btrim(p_payment_reference), p_paid_at, (SELECT auth.uid()));
  RETURN v_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_business_payment_instructions(
  p_account_holder text,
  p_bank_name text,
  p_account_reference text,
  p_instructions text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT coalesce((SELECT public.has_admin_permission('finance')), false) THEN
    RAISE EXCEPTION 'Permission finance requise' USING ERRCODE = '42501';
  END IF;
  IF p_account_holder IS NULL OR char_length(btrim(p_account_holder)) NOT BETWEEN 2 AND 200
     OR p_bank_name IS NULL OR char_length(btrim(p_bank_name)) NOT BETWEEN 2 AND 200
     OR p_account_reference IS NULL OR char_length(btrim(p_account_reference)) NOT BETWEEN 2 AND 200
     OR char_length(coalesce(p_instructions, '')) > 2000 THEN
    RAISE EXCEPTION 'Coordonnées de paiement invalides' USING ERRCODE = '22023';
  END IF;
  UPDATE public.subscription_payment_instructions
  SET account_holder = btrim(p_account_holder),
      bank_name = btrim(p_bank_name),
      account_reference = btrim(p_account_reference),
      instructions = btrim(coalesce(p_instructions, '')),
      updated_by = (SELECT auth.uid()),
      updated_at = now()
  WHERE id = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.request_business_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_business_subscription() TO authenticated;
REVOKE ALL ON FUNCTION public.submit_business_subscription_proof(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_business_subscription_proof(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_review_business_subscription(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_business_subscription(uuid, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_create_enterprise_contract(uuid, integer, numeric, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_enterprise_contract(uuid, integer, numeric, timestamptz, timestamptz, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_record_enterprise_payment(uuid, integer, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_record_enterprise_payment(uuid, integer, text, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_business_payment_instructions(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_business_payment_instructions(text, text, text, text) TO authenticated;

COMMIT;
