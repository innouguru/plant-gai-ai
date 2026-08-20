-- =============================================================================
-- Plant-GAI-AI — Phase 3: farm-scoped messaging
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id    uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    recipient_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    body         text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    read_at      timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT messages_distinct_users CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS messages_sender_created_at_idx
    ON public.messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient_created_at_idx
    ON public.messages (recipient_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Messages are inserted and read-state transitions are performed only through
-- the narrowly scoped functions below.
REVOKE INSERT, UPDATE, DELETE ON public.messages FROM anon, authenticated;

CREATE POLICY "select own messages" ON public.messages
    FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "update received message read state" ON public.messages
    FOR UPDATE USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());

CREATE OR REPLACE FUNCTION public.message_participants_allowed(
    p_sender_id uuid,
    p_recipient_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT sender.farm_id IS NOT NULL
       AND sender.farm_id = recipient.farm_id
       AND sender.role <> recipient.role
    FROM public.profiles sender
    JOIN public.profiles recipient ON recipient.id = p_recipient_id
    WHERE sender.id = p_sender_id;
$$;

CREATE OR REPLACE FUNCTION public.send_message(p_recipient_id uuid, p_body text)
RETURNS TABLE(
    id uuid, sender_id uuid, sender_name text, recipient_id uuid,
    recipient_name text, body text, read_at timestamptz, created_at timestamptz
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
           v_message.body, v_message.read_at, v_message.created_at
    FROM public.profiles sender
    JOIN public.profiles recipient ON recipient.id = v_message.recipient_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_messages(p_limit integer DEFAULT 100)
RETURNS TABLE(
    id uuid, sender_id uuid, sender_name text, recipient_id uuid,
    recipient_name text, body text, read_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
    RETURN QUERY
    SELECT m.id, m.sender_id, COALESCE(sender.full_name, sender.email),
           m.recipient_id, COALESCE(recipient.full_name, recipient.email),
           m.body, m.read_at, m.created_at
    FROM public.messages m
    JOIN public.profiles sender ON sender.id = m.sender_id
    JOIN public.profiles recipient ON recipient.id = m.recipient_id
    WHERE m.sender_id = v_user OR m.recipient_id = v_user
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id uuid)
RETURNS TABLE(
    id uuid, sender_id uuid, sender_name text, recipient_id uuid,
    recipient_name text, body text, read_at timestamptz, created_at timestamptz
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
    SET read_at = COALESCE(m.read_at, now())
    WHERE m.id = p_message_id AND m.recipient_id = v_user
    RETURNING m.id, m.sender_id,
        (SELECT COALESCE(p.full_name, p.email) FROM public.profiles p WHERE p.id = m.sender_id),
        m.recipient_id,
        (SELECT COALESCE(p.full_name, p.email) FROM public.profiles p WHERE p.id = m.recipient_id),
        m.body, m.read_at, m.created_at;
END;
$$;

GRANT SELECT ON public.messages TO authenticated;
REVOKE EXECUTE ON FUNCTION public.message_participants_allowed(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_message(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_messages(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_message_read(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_messages(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_message_read(uuid) TO authenticated;
