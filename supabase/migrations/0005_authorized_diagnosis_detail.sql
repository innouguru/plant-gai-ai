-- =============================================================================
-- Plant-GAI-AI — Authorized diagnosis detail
-- Reuses GET /api/v1/diagnosis/{id} for farmers and farm admins.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_authorized_diagnosis(p_diagnosis_id uuid)
RETURNS TABLE(
    id uuid,
    farmer_id uuid,
    farmer_name text,
    farm_id uuid,
    disease text,
    confidence numeric,
    crop text,
    model_version text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := auth.uid();
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    RETURN QUERY
        SELECT d.id, d.farmer_id, COALESCE(farmer.full_name, farmer.email), d.farm_id,
            d.disease, d.confidence, d.crop, d.model_version, d.created_at
    FROM public.diagnoses d
    JOIN public.profiles caller ON caller.id = v_user
        JOIN public.profiles farmer ON farmer.id = d.farmer_id
    WHERE d.id = p_diagnosis_id
      AND (
          d.farmer_id = v_user
          OR (
              caller.role = 'farm_admin'
              AND caller.farm_id IS NOT NULL
              AND d.farm_id = caller.farm_id
          )
      );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_authorized_diagnosis(uuid) TO authenticated;
