-- =============================================================================
-- Plant-GAI-AI — Phase 1: Authentication & application foundation
-- Tables: farms, profiles, invitations
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enum types
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('farmer', 'farm_admin');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status') THEN
        CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted');
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Core tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.farms (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
    admin_id   uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id         uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email      text NOT NULL,
    full_name  text,
    role       public.app_role NOT NULL DEFAULT 'farmer',
    farm_id    uuid REFERENCES public.farms (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Resolve the circular farm <-> profile relationship after both exist.
ALTER TABLE public.farms
    DROP CONSTRAINT IF EXISTS farms_admin_id_fkey;
ALTER TABLE public.farms
    ADD CONSTRAINT farms_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES public.profiles (id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.invitations (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id      uuid NOT NULL REFERENCES public.farms (id) ON DELETE CASCADE,
    email        text NOT NULL,
    invited_name text,
    status       public.invitation_status NOT NULL DEFAULT 'pending',
    created_at   timestamptz NOT NULL DEFAULT now(),
    accepted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS profiles_farm_id_idx      ON public.profiles (farm_id);
CREATE INDEX IF NOT EXISTS invitations_farm_id_idx   ON public.invitations (farm_id);
CREATE INDEX IF NOT EXISTS invitations_email_idx     ON public.invitations (email, status);

-- -----------------------------------------------------------------------------
-- 3. Auto-create a profile when a Supabase Auth user is created
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data ->> 'full_name',
        'farmer'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. Row Level Security
-- -----------------------------------------------------------------------------

ALTER TABLE public.farms       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- farms: read-only for members/admins. All writes go through SECURITY DEFINER
-- functions so a user can never fabricate admin membership.
CREATE POLICY "select farm as admin" ON public.farms
    FOR SELECT USING (admin_id = auth.uid());

CREATE POLICY "select farm as member" ON public.farms
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.farm_id = public.farms.id AND p.id = auth.uid()
        )
    );

-- profiles: users read themselves; farm admins read their own farm's members.
-- No INSERT/UPDATE/DELETE policies — role/farm changes happen only inside
-- SECURITY DEFINER functions keyed on auth.uid().
CREATE POLICY "select own profile" ON public.profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "select farm members for admin" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.farms f
            WHERE f.id = public.profiles.farm_id AND f.admin_id = auth.uid()
        )
    );

-- invitations: farm admin of the target farm manages them; the invited farmer
-- can read their own (used by verification tooling).
CREATE POLICY "insert invitation by farm admin" ON public.invitations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'farm_admin'
              AND p.farm_id = public.invitations.farm_id
        )
    );

CREATE POLICY "read invitation by farm admin" ON public.invitations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'farm_admin'
              AND p.farm_id = public.invitations.farm_id
        )
    );

CREATE POLICY "read own invitation" ON public.invitations
    FOR SELECT USING (
        LOWER(email) = LOWER(
            (SELECT email FROM public.profiles WHERE id = auth.uid())
        )
    );

-- -----------------------------------------------------------------------------
-- 5. Privileged transitions (SECURITY DEFINER, always re-check auth.uid())
-- -----------------------------------------------------------------------------

-- Admin onboarding: create the farm and promote the caller to farm_admin.
-- A user can only ever do this while they have no farm assigned yet and no
-- pending invitation (invited farmers must claim their invitation instead of
-- creating their own farm).
CREATE OR REPLACE FUNCTION public.complete_admin_onboarding(new_farm_name text)
RETURNS SETOF public.farms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user     uuid := auth.uid();
    v_farm     public.farms;
    v_busy     boolean;
    v_invited  boolean;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_user AND p.farm_id IS NOT NULL)
    INTO v_busy;

    IF v_busy THEN
        RAISE EXCEPTION 'already_onboarded';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.invitations inv
        JOIN public.profiles p ON LOWER(p.email) = LOWER(inv.email)
        WHERE p.id = v_user
          AND inv.status = 'pending'
    )
    INTO v_invited;

    IF v_invited THEN
        RAISE EXCEPTION 'pending_invitation';
    END IF;

    INSERT INTO public.farms (name, admin_id)
    VALUES (new_farm_name, v_user)
    RETURNING * INTO v_farm;

    UPDATE public.profiles
    SET role = 'farm_admin', farm_id = v_farm.id
    WHERE id = v_user;

    RETURN QUERY SELECT * FROM public.farms WHERE id = v_farm.id;
END;
$$;

-- Update the caller's own display name (used during invitation acceptance).
CREATE OR REPLACE FUNCTION public.update_profile_full_name(p_full_name text)
RETURNS SETOF public.profiles
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
        UPDATE public.profiles
        SET full_name = p_full_name
        WHERE id = v_user
        RETURNING *;
END;
$$;

-- Bind the caller to the farm of their oldest pending invitation.
-- Role and farm are derived from the invitation row, never from the client.
CREATE OR REPLACE FUNCTION public.claim_pending_invitation()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := auth.uid();
    v_inv  public.invitations;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT inv.* INTO v_inv
    FROM public.invitations inv
    JOIN public.profiles p ON LOWER(p.email) = LOWER(inv.email)
    WHERE p.id = v_user
      AND inv.status = 'pending'
    ORDER BY inv.created_at ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'no_pending_invitation';
    END IF;

    UPDATE public.invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_inv.id;

    RETURN QUERY
        UPDATE public.profiles
        SET role = 'farmer', farm_id = v_inv.farm_id
        WHERE id = v_user
        RETURNING *;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Standard Supabase grants (RLS still governs what each role can do)
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;