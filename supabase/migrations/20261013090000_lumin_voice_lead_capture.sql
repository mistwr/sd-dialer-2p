-- Lumin voice lead capture: canonical phone deduplication and atomic call claims.

CREATE OR REPLACE FUNCTION public.canonical_lumin_voice_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits text;
BEGIN
  IF p_phone IS NULL THEN
    RETURN NULL;
  END IF;

  v_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF v_digits = '' THEN
    RETURN NULL;
  END IF;

  IF left(v_digits, 2) = '00' THEN
    v_digits := substr(v_digits, 3);
  ELSIF length(v_digits) = 9 THEN
    v_digits := '351' || v_digits;
  END IF;

  RETURN '+' || v_digits;
END;
$$;

CREATE INDEX IF NOT EXISTS leads_company_lumin_canonical_phone_idx
  ON public.leads (company_id, public.canonical_lumin_voice_phone(telefone))
  WHERE telefone IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lumin_voice_lead_calls (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  call_id text NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, call_id)
);

CREATE TABLE IF NOT EXISTS public.lumin_voice_lead_phone_claims (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  canonical_phone text NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, canonical_phone)
);

ALTER TABLE public.lumin_voice_lead_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lumin_voice_lead_phone_claims ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.lumin_voice_register_lead(
  p_company_id uuid,
  p_call_id text,
  p_phone text,
  p_name text,
  p_email text,
  p_interest text,
  p_current_operator text,
  p_summary text,
  p_next_action text,
  p_consent_at timestamptz,
  p_consent_to_contact boolean
)
RETURNS TABLE (
  lead_id uuid,
  created boolean,
  deduplicated boolean,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone text := public.canonical_lumin_voice_phone(p_phone);
  v_lead public.leads%ROWTYPE;
  v_lead_id uuid;
  v_created boolean := false;
  v_deduplicated boolean := false;
  v_consent_at timestamptz := COALESCE(p_consent_at, now());
  v_custom_fields jsonb;
  v_note text;
BEGIN
  IF p_company_id IS NULL OR COALESCE(BTRIM(p_call_id), '') = '' THEN
    RAISE EXCEPTION 'company_id and call_id are required';
  END IF;
  IF v_phone IS NULL OR COALESCE(BTRIM(p_name), '') = '' THEN
    RAISE EXCEPTION 'valid phone and name are required';
  END IF;
  IF p_interest NOT IN ('telecomunicacoes', 'energia', 'ambos') THEN
    RAISE EXCEPTION 'valid interest is required';
  END IF;
  IF p_consent_to_contact IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'explicit contact consent is required';
  END IF;

  -- The primary key serializes retries for the same Twilio call.
  INSERT INTO public.lumin_voice_lead_calls (company_id, call_id)
  VALUES (p_company_id, p_call_id)
  ON CONFLICT (company_id, call_id) DO NOTHING;

  IF NOT FOUND THEN
    SELECT calls.lead_id
      INTO v_lead_id
      FROM public.lumin_voice_lead_calls AS calls
      WHERE calls.company_id = p_company_id
        AND calls.call_id = p_call_id;

    IF v_lead_id IS NULL THEN
      RAISE EXCEPTION 'voice call was already claimed but has no lead';
    END IF;

    SELECT leads.*
      INTO v_lead
      FROM public.leads AS leads
      WHERE leads.id = v_lead_id
        AND leads.company_id = p_company_id;

    RETURN QUERY
      SELECT v_lead_id, false, true, COALESCE(v_lead.status::text, 'novo');
    RETURN;
  END IF;

  -- This unique row serializes different calls for the same canonical phone.
  INSERT INTO public.lumin_voice_lead_phone_claims (company_id, canonical_phone)
  VALUES (p_company_id, v_phone)
  ON CONFLICT (company_id, canonical_phone) DO NOTHING;

  SELECT claims.lead_id
    INTO v_lead_id
    FROM public.lumin_voice_lead_phone_claims AS claims
    WHERE claims.company_id = p_company_id
      AND claims.canonical_phone = v_phone
    FOR UPDATE;

  IF v_lead_id IS NOT NULL THEN
    SELECT leads.*
      INTO v_lead
      FROM public.leads AS leads
      WHERE leads.id = v_lead_id
        AND leads.company_id = p_company_id
      FOR UPDATE;

    IF NOT FOUND OR public.canonical_lumin_voice_phone(v_lead.telefone) IS DISTINCT FROM v_phone THEN
      v_lead_id := NULL;
      UPDATE public.lumin_voice_lead_phone_claims AS claims
        SET lead_id = NULL
        WHERE claims.company_id = p_company_id
          AND claims.canonical_phone = v_phone;
    END IF;
  END IF;

  IF v_lead_id IS NULL THEN
    SELECT leads.*
      INTO v_lead
      FROM public.leads AS leads
      WHERE leads.company_id = p_company_id
        AND public.canonical_lumin_voice_phone(leads.telefone) = v_phone
      ORDER BY leads.id
      LIMIT 1
      FOR UPDATE;

    IF FOUND THEN
      v_lead_id := v_lead.id;
      v_deduplicated := true;
    ELSE
      v_note := concat_ws(
        E'\n',
        'Lead de chamada telefónica — Lumin AI',
        'Chamada: ' || p_call_id,
        'Interesse: ' || p_interest,
        CASE WHEN NULLIF(BTRIM(p_current_operator), '') IS NOT NULL
          THEN 'Operador atual: ' || BTRIM(p_current_operator) END,
        CASE WHEN NULLIF(BTRIM(p_summary), '') IS NOT NULL
          THEN 'Resumo: ' || BTRIM(p_summary) END,
        CASE WHEN NULLIF(BTRIM(p_next_action), '') IS NOT NULL
          THEN 'Próxima ação: ' || BTRIM(p_next_action) END,
        'Autorização de contacto confirmada em ' || v_consent_at::text
      );

      v_custom_fields := jsonb_build_object(
        'source', 'lumin_voice_agent',
        'temperature', 'warm',
        'voice_call_id', p_call_id,
        'voice_interest', p_interest,
        'voice_current_operator', NULLIF(BTRIM(p_current_operator), ''),
        'voice_summary', NULLIF(BTRIM(p_summary), ''),
        'voice_next_action', NULLIF(BTRIM(p_next_action), ''),
        'voice_contact_consent', true,
        'voice_contact_consent_at', v_consent_at
      );

      INSERT INTO public.leads (
        nome,
        telefone,
        email,
        company_id,
        status,
        origem,
        imported_at,
        observacoes,
        custom_fields
      )
      VALUES (
        BTRIM(p_name),
        v_phone,
        NULLIF(BTRIM(p_email), ''),
        p_company_id,
        'novo',
        'outro',
        v_consent_at,
        v_note,
        v_custom_fields
      )
      RETURNING * INTO v_lead;

      v_lead_id := v_lead.id;
      v_created := true;
    END IF;
  ELSE
    v_deduplicated := true;
  END IF;

  IF NOT v_created THEN
    v_note := concat_ws(
      E'\n',
      'Lead de chamada telefónica — Lumin AI',
      'Chamada: ' || p_call_id,
      'Interesse: ' || p_interest,
      CASE WHEN NULLIF(BTRIM(p_current_operator), '') IS NOT NULL
        THEN 'Operador atual: ' || BTRIM(p_current_operator) END,
      CASE WHEN NULLIF(BTRIM(p_summary), '') IS NOT NULL
        THEN 'Resumo: ' || BTRIM(p_summary) END,
      CASE WHEN NULLIF(BTRIM(p_next_action), '') IS NOT NULL
        THEN 'Próxima ação: ' || BTRIM(p_next_action) END,
      'Autorização de contacto confirmada em ' || v_consent_at::text
    );

    v_custom_fields := COALESCE(v_lead.custom_fields, '{}'::jsonb);
    IF jsonb_typeof(v_custom_fields) IS DISTINCT FROM 'object' THEN
      v_custom_fields := '{}'::jsonb;
    END IF;
    IF NOT (v_custom_fields ? 'source') THEN
      v_custom_fields := v_custom_fields || jsonb_build_object('source', 'lumin_voice_agent');
    END IF;
    IF NOT (v_custom_fields ? 'temperature') THEN
      v_custom_fields := v_custom_fields || jsonb_build_object('temperature', 'warm');
    END IF;
    v_custom_fields := v_custom_fields || jsonb_build_object(
      'voice_call_id', p_call_id,
      'voice_interest', p_interest,
      'voice_current_operator', NULLIF(BTRIM(p_current_operator), ''),
      'voice_summary', NULLIF(BTRIM(p_summary), ''),
      'voice_next_action', NULLIF(BTRIM(p_next_action), ''),
      'voice_contact_consent', true,
      'voice_contact_consent_at', v_consent_at
    );

    UPDATE public.leads AS leads
      SET nome = CASE
            WHEN COALESCE(NULLIF(BTRIM(leads.nome), ''), '') = ''
              OR BTRIM(leads.nome) ~* '^(lead|contacto|cliente)([[:space:]]|$)'
            THEN BTRIM(p_name)
            ELSE leads.nome
          END,
          email = COALESCE(NULLIF(BTRIM(leads.email), ''), NULLIF(BTRIM(p_email), '')),
          observacoes = concat_ws(E'\n', NULLIF(leads.observacoes, ''), v_note),
          custom_fields = v_custom_fields
      WHERE leads.id = v_lead_id
        AND leads.company_id = p_company_id
      RETURNING leads.* INTO v_lead;
  END IF;

  UPDATE public.lumin_voice_lead_phone_claims AS claims
    SET lead_id = v_lead_id
    WHERE claims.company_id = p_company_id
      AND claims.canonical_phone = v_phone;

  UPDATE public.lumin_voice_lead_calls AS calls
    SET lead_id = v_lead_id
    WHERE calls.company_id = p_company_id
      AND calls.call_id = p_call_id;

  RETURN QUERY
    SELECT v_lead_id, v_created, v_deduplicated, COALESCE(v_lead.status::text, 'novo');
END;
$$;

REVOKE ALL ON FUNCTION public.lumin_voice_register_lead(
  uuid, text, text, text, text, text, text, text, text, timestamptz, boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.lumin_voice_register_lead(
  uuid, text, text, text, text, text, text, text, text, timestamptz, boolean
) TO service_role;
