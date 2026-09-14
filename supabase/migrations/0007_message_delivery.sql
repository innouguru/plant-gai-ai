-- =============================================================================
-- Plant-GAI-AI — Phase 3 follow-up: message delivery tracking
--
-- Adds delivered_at to public.messages so the sender can distinguish
-- Sent (stored) from Delivered (recipient's client fetched the message)
-- from Read (recipient opened the message / read_at set).
--
-- No RLS change. The stamping writes are scoped exactly like the existing
-- messaging write paths:
--   - list_messages sets delivered_at only where recipient_id = auth.uid()
--   - mark_message_read sets delivered_at alongside read_at, also only where
--     recipient_id = auth.uid()
-- The same-farm / opposite-role / cross-farm restrictions in send_message and
-- message_participants_allowed are untouched.
-- =============================================================================

ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- -----------------------------------------------------------------------------
-- send_message — returns delivered_at (always NULL at creation time)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_message(p_recipient_id uuid, p_body text)
RETURNS TABLE(
    id uuid, sender_id uuid, sender_name text, recipient_id uuid,
    recipient_name text, body text, read_at timestamptz,
    delivered_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sender uuid := auth.uid();
    v_message public.messages;
BEGIN
    IF v_sender IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
    IF NOT public.message_participants_allowed(v_sender, p_recipient_id) THEN
        RAISE EXCEPTION 'message_forbidden';
    END IF;
    INSERT INTO public.messages (sender_id, recipient_id, body)
    VALUES (v_sender, p_recipient_id, p_body)
    RETURNING * INTO v_message;
    RETURN QUERY
    SELECT v_message.id, v_message.sender_id, COALESCE(sender.full_name, sender.email),
           v_message.recipient_id, COALESCE(recipient.full_name, recipient.email),
           v_message.body, v_message.read_at, v_message.delivered_at, v_message.created_at
    FROM public.profiles sender
    JOIN public.profiles recipient ON recipient.id = v_message.recipient_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- list_messages — stamps delivered_at on the recipient's first fetch, then
-- returns all messages involving the caller (unchanged semantics otherwise).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_messages(p_limit integer DEFAULT 100)
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
    UPDATE public.messages
    SET delivered_at = COALESCE(delivered_at, now())
    WHERE recipient_id = v_user
      AND delivered_at IS NULL;
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

-- -----------------------------------------------------------------------------
-- mark_message_read — sets read_at and guarantees delivered_at is populated at
-- the same time (Read can never occur without Delivered).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id uuid)
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
    RETURN QUERY
    UPDATE public.messages m
    SET read_at = COALESCE(m.read_at, now()),
        delivered_at = COALESCE(m.delivered_at, now())
    WHERE m.id = p_message_id AND m.recipient_id = v_user
    RETURNING m.id, m.sender_id,
        (SELECT COALESCE(p.full_name, p.email) FROM public.profiles p WHERE p.id = m.sender_id),
        m.recipient_id,
        (SELECT COALESCE(p.full_name, p.email) FROM public.profiles p WHERE p.id = m.recipient_id),
        m.body, m.read_at, m.delivered_at, m.created_at;
END;
$$;

-- Re-assert the messaging grants (CREATE OR REPLACE preserves grants, but keep
-- the migration self-contained and explicit like migration 0006).
REVOKE EXECUTE ON FUNCTION public.send_message(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_messages(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_message_read(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_messages(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_message_read(uuid) TO authenticated;