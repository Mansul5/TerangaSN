-- TerangaSN V1.2 — Activation initiale d'un hôte Standard.
-- Exécuter UNE SEULE FOIS après schema.sql et les migrations PMS/réservation.
-- Ne modifie pas les réservations ni les stocks.
BEGIN;

-- Le trigger continue de bloquer tout changement de rôle depuis un client.
-- Les opérations serveur exécutées en tant que propriétaire postgres peuvent
-- toutefois changer le rôle dans une transaction contrôlée.
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user <> 'postgres' AND NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Protected profile fields cannot be modified';
    END IF;
    IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
      IF OLD.name_changed_at IS NOT NULL AND OLD.name_changed_at > now() - interval '30 days' THEN
        RAISE EXCEPTION 'Name can only be changed once every 30 days';
      END IF;
      NEW.name_changed_at := now();
    ELSE
      NEW.name_changed_at := OLD.name_changed_at;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_host_standard(
  p_lodging_name text,
  p_category text,
  p_region text,
  p_city text,
  p_address text,
  p_description text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_hotel_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF NULLIF(btrim(p_lodging_name), '') IS NULL OR length(btrim(p_lodging_name)) > 180
     OR NULLIF(btrim(p_region), '') IS NULL OR length(btrim(p_region)) > 120
     OR NULLIF(btrim(p_city), '') IS NULL OR length(btrim(p_city)) > 120
     OR NULLIF(btrim(p_address), '') IS NULL OR length(btrim(p_address)) > 500
     OR length(COALESCE(p_description, '')) > 5000 THEN
    RAISE EXCEPTION 'Informations de l''établissement invalides';
  END IF;

  IF p_category IS NULL OR p_category NOT IN
    ('hotel','lodge','campement','residence','villa','appartement','chambre_hotes') THEN
    RAISE EXCEPTION 'Catégorie d''hébergement invalide';
  END IF;

  -- Verrouille le profil pour empêcher deux activations simultanées.
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil introuvable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.hotels WHERE owner_id = v_uid) THEN
    RAISE EXCEPTION 'Un établissement existe déjà pour ce compte';
  END IF;
  IF EXISTS (SELECT 1 FROM public.owner_subscriptions WHERE owner_id = v_uid) THEN
    RAISE EXCEPTION 'Un abonnement hôte existe déjà pour ce compte';
  END IF;

  INSERT INTO public.owner_subscriptions(owner_id, plan_code, status)
  VALUES (v_uid, 'standard', 'active');

  -- Aucun utilisateur ne peut demander un rôle via les arguments RPC.
  -- Ne jamais rétrograder un administrateur existant.
  IF v_role = 'traveler' THEN
    UPDATE public.profiles SET role = 'owner' WHERE id = v_uid;
  END IF;

  INSERT INTO public.hotels(owner_id, name, category, region, city, address, description, status)
  VALUES (v_uid, btrim(p_lodging_name), p_category, btrim(p_region), btrim(p_city),
          btrim(p_address), COALESCE(btrim(p_description), ''), 'pending')
  RETURNING id INTO v_hotel_id;

  RETURN v_hotel_id;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_host_standard(text,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_host_standard(text,text,text,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.activate_host_standard(text,text,text,text,text,text) TO authenticated;

COMMIT;
