-- =============================================================================
-- Plant-GAI-AI — Phase 3: Diagnosis history & storage
-- Table: diagnoses (append-only, immutable)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. diagnoses table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diagnoses (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id     uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    farm_id       uuid NOT NULL REFERENCES public.farms (id) ON DELETE CASCADE,
    disease       text NOT NULL CHECK (char_length(disease) BETWEEN 1 AND 200),
    confidence    numeric NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    crop          text NOT NULL CHECK (char_length(crop) BETWEEN 1 AND 80),
    model_version text NOT NULL CHECK (char_length(model_version) BETWEEN 1 AND 40),
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS diagnoses_farmer_id_created_at_idx
    ON public.diagnoses (farmer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS diagnoses_farm_id_idx
    ON public.diagnoses (farm_id);

-- -----------------------------------------------------------------------------
-- 2. Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;

-- A farmer can read only their own diagnosis records.
CREATE POLICY "select own diagnosis" ON public.diagnoses
    FOR SELECT USING (farmer_id = auth.uid());

-- A farm admin can read all diagnoses from their own farm (farm-level views
-- arrive with the reporting phase). The admin's farm is resolved from the
-- farms table, never from a client-supplied value.
CREATE POLICY "select farm diagnoses for admin" ON public.diagnoses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.farms f
            WHERE f.id = public.diagnoses.farm_id
              AND f.admin_id = auth.uid()
        )
    );

-- No INSERT/UPDATE/DELETE policies: diagnosis rows are append-only and
-- immutable. Inserts happen exclusively through save_diagnosis() below, which
-- derives farmer_id/farm_id from auth.uid() and the caller's profile.
-- Without an INSERT policy, direct client-side inserts are rejected by RLS.

-- -----------------------------------------------------------------------------
-- 3. Save diagnosis (SECURITY DEFINER, derives ownership from the JWT)
-- -----------------------------------------------------------------------------
-- farmer_id and farm_id are derived from auth.uid() and the caller's profile;
-- the client can never choose them. The caller must be a farmer on a farm.
CREATE OR REPLACE FUNCTION public.save_diagnosis(
    p_disease text,
    p_confidence numeric,
    p_crop text,
    p_model_version text
)
RETURNS SETOF public.diagnoses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user     uuid := auth.uid();
    v_profile  public.profiles;
    v_row      public.diagnoses;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user;

    IF NOT FOUND OR v_profile.role <> 'farmer' OR v_profile.farm_id IS NULL THEN
        RAISE EXCEPTION 'diagnosis_forbidden';
    END IF;

    INSERT INTO public.diagnoses (farmer_id, farm_id, disease, confidence, crop, model_version)
    VALUES (v_user, v_profile.farm_id, p_disease, p_confidence, p_crop, p_model_version)
    RETURNING * INTO v_row;

    RETURN NEXT v_row;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Grants (RLS still governs every row access)
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.diagnoses TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_diagnosis(text, numeric, text, text) TO authenticated;