-- =============================================================================
-- Plant-GAI-AI — Phase 3 follow-up: fix ambiguous delivered_at in list_messages
--
-- Production reported: GET /api/v1/messages -> 502, provider_error
-- supabase_status=400, error_code=42702 (ambiguous column reference).
--
-- Root cause: public.list_messages() declares RETURNS TABLE(..., delivered_at)
-- and then ran an unqualified UPDATE:
--
--   UPDATE public.messages
--   SET delivered_at = COALESCE(delivered_at, now())
--   WHERE recipient_id = v_user AND delivered_at IS NULL;
--
-- The bare delivered_at collides with the output parameter of the same name,
-- so PostgreSQL cannot tell the column from the parameter (42702).
--
-- This migration recreates ONLY list_messages() with the target table aliased
-- and every reference qualified (UPDATE public.messages AS m ...). Everything
-- else is preserved exactly:
--   - signature / RETURNS TABLE (including delivered_at)
--   - SECURITY DEFINER, SET search_path = public
--   - authentication check
--   - recipient-only delivered_at stamping (recipient_id = auth.uid())
--   - message selection / ordering / limit behavior
--   - grants
-- No RLS, permission, API, frontend, or backend application changes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- list_messages — stamps delivered_at on the recipient's first fetch, then
-- returns all messages involving the caller (unchanged semantics otherwise).
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_messages(integer);
CREATE FUNCTION public.list_messages(p_limit integer DEFAULT 100)
RETURNS TABLE(
    id uuid, sender_id uuid, sender_name text, recipient_id uuid,
    recipient_name text, body text, read_at timestamptz,
    delivered_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
    UPDATE public.messages AS m
    SET delivered_at = COALESCE(m.delivered_at, now())
    WHERE m.recipient_id = v_user
      AND m.delivered_at IS NULL;
    RETURN QUERY
    SELECT m.id, m.sender_id, COALESCE(sender.full_name, sender.email),
           m.recipient_id, COALESCE(recipient.full_name, recipient.email),
           m.body, m.read_at, m.delivered_at, m.created_at
    FROM public.messages m
    JOIN public.profiles sender ON sender.id = m.sender_id
    JOIN public.profiles recipient ON recipient.id = m.recipient_id
    WHERE m.sender_id = v_user OR m.recipient_id = v_user
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 100);
END;
$$;

-- Re-assert the messaging grants (DROP removes privileges, so re-granting is
-- required for the recreated function, matching migration 0007's grants).
REVOKE EXECUTE ON FUNCTION public.list_messages(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_messages(integer) TO authenticated;