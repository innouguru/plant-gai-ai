-- =============================================================================
-- Plant-GAI-AI — Phase 3: Farm statistics
-- Index for farm-scoped analytics + SECURITY DEFINER aggregation RPC
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Analytics index
-- -----------------------------------------------------------------------------
-- Farm-level dashboards always filter diagnoses by farm_id and order by
-- created_at, so a composite index beats the existing single-column farm_id
-- index for reporting queries.
CREATE INDEX IF NOT EXISTS diagnoses_farm_id_created_at_idx
    ON public.diagnoses (farm_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. Farm statistics RPC (SECURITY DEFINER, caller derived from the JWT)
-- -----------------------------------------------------------------------------
-- Aggregates diagnoses and profiles for the caller's own farm. PostgREST
-- cannot GROUP BY on a base table, so aggregation runs here in SQL with full
-- row-level control. The caller's identity and farm membership always come
-- from auth.uid() and the profiles row, never from the client.
--
-- Healthy vs diseased follows the immutable 22-class naming convention
-- (model/metadata/class_names.json): the healthy classes are exactly the ones
-- ending in "<crop> healthy" ("Cashew healthy", "Cassava healthy",
-- "Maize healthy", "Tomato healthy"), matching the frontend derivation in
-- frontend/src/data/crops.js and the service helper is_healthy_class().
CREATE OR REPLACE FUNCTION public.get_farm_statistics(p_farm_id uuid)
RETURNS TABLE(
    farm_id            uuid,
    farmer_count       bigint,
    total_diagnoses    bigint,
    healthy_diagnoses  bigint,
    diseased_diagnoses bigint,
    disease_counts     jsonb,
    crop_counts        jsonb,
    top_diseases       jsonb,
    top_crops          jsonb,
    recent_diagnoses   jsonb
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

    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'profile_not_found';
    END IF;

    -- The caller must be a farm_admin whose own farm is the requested one.
    -- This re-checks the cross-farm boundary even if the route already did.
    IF v_profile.role <> 'farm_admin' OR v_profile.farm_id IS NULL
       OR v_profile.farm_id <> p_farm_id THEN
        RAISE EXCEPTION 'farm_stats_forbidden';
    END IF;

    RETURN QUERY
    SELECT
        p_farm_id,
        -- Everyone linked to the farm (mirrors GET /farms/{id}/members).
        (SELECT count(*)::bigint FROM public.profiles p WHERE p.farm_id = p_farm_id),
        (SELECT count(*)::bigint FROM public.diagnoses d WHERE d.farm_id = p_farm_id),
        (SELECT count(*)::bigint FROM public.diagnoses d
          WHERE d.farm_id = p_farm_id AND d.disease ILIKE '% healthy'),
        (SELECT count(*)::bigint FROM public.diagnoses d
          WHERE d.farm_id = p_farm_id AND d.disease NOT ILIKE '% healthy'),
        COALESCE((
            SELECT jsonb_object_agg(s.disease, s.cnt)
            FROM (
                SELECT d.disease AS disease, count(*)::int AS cnt
                FROM public.diagnoses d
                WHERE d.farm_id = p_farm_id
                GROUP BY d.disease
            ) s
        ), '{}'::jsonb),
        COALESCE((
            SELECT jsonb_object_agg(s.crop, s.cnt)
            FROM (
                SELECT d.crop AS crop, count(*)::int AS cnt
                FROM public.diagnoses d
                WHERE d.farm_id = p_farm_id
                GROUP BY d.crop
            ) s
        ), '{}'::jsonb),
        COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object('disease', s.disease, 'count', s.cnt)
                ORDER BY s.cnt DESC, s.disease ASC
            )
            FROM (
                SELECT d.disease AS disease, count(*)::int AS cnt
                FROM public.diagnoses d
                WHERE d.farm_id = p_farm_id
                GROUP BY d.disease
                ORDER BY cnt DESC, disease ASC
                LIMIT 5
            ) s
        ), '[]'::jsonb),
        COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object('crop', s.crop, 'count', s.cnt)
                ORDER BY s.cnt DESC, s.crop ASC
            )
            FROM (
                SELECT d.crop AS crop, count(*)::int AS cnt
                FROM public.diagnoses d
                WHERE d.farm_id = p_farm_id
                GROUP BY d.crop
                ORDER BY cnt DESC, crop ASC
                LIMIT 5
            ) s
        ), '[]'::jsonb),
        COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', d.id,
                    'farmer_id', d.farmer_id,
                    'farmer_name', COALESCE(p.full_name, p.email),
                    'disease', d.disease,
                    'crop', d.crop,
                    'confidence', d.confidence,
                    'created_at', d.created_at
                )
                ORDER BY d.created_at DESC, d.id DESC
            )
            FROM public.diagnoses d
            JOIN public.profiles p ON p.id = d.farmer_id
            WHERE d.farm_id = p_farm_id
            LIMIT 10
        ), '[]'::jsonb)
    ;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Grants (RLS still governs every direct row access)
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_farm_statistics(uuid) TO authenticated;