-- =============================================================================
-- Plant-GAI-AI — Phase 3: Farm diagnosis feed
-- Paginated, farm-scoped diagnosis rows for farm administrators.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_farm_diagnoses(
    p_farm_id uuid,
    p_limit integer DEFAULT 20,
    p_offset integer DEFAULT 0
)
RETURNS TABLE(
    id            uuid,
    farmer_id     uuid,
    farmer_name   text,
    disease       text,
    confidence    numeric,
    crop          text,
    model_version text,
    created_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user    uuid := auth.uid();
    v_profile public.profiles;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE profiles.id = v_user;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'profile_not_found';
    END IF;

    IF v_profile.role <> 'farm_admin'
       OR v_profile.farm_id IS NULL
       OR v_profile.farm_id <> p_farm_id THEN
        RAISE EXCEPTION 'farm_stats_forbidden';
    END IF;

    IF p_limit < 1 OR p_limit > 100 OR p_offset < 0 THEN
        RAISE EXCEPTION 'invalid_pagination';
    END IF;

    RETURN QUERY
    SELECT
        d.id,
        d.farmer_id,
        COALESCE(p.full_name, p.email),
        d.disease,
        d.confidence,
        d.crop,
        d.model_version,
        d.created_at
    FROM public.diagnoses d
    JOIN public.profiles p ON p.id = d.farmer_id
    WHERE d.farm_id = p_farm_id
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_farm_diagnoses(uuid, integer, integer) TO authenticated;
