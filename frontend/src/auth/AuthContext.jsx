import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "./supabase";
import { fetchMe } from "../api/auth";
import { isSessionExpiredError, SESSION_EXPIRED_MESSAGE } from "../api/client";

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

function normalizeProfile(profile) {
  if (!profile) {
    return null;
  }
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name ?? null,
    role: profile.role,
    farmId: profile.farm_id ?? null,
    farm: profile.farm ?? null,
    requiresOnboarding: Boolean(profile.requires_onboarding),
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const refreshProfile = useCallback(async (accessToken) => {
    if (!accessToken) {
      return null;
    }
    try {
      const data = await fetchMe(accessToken);
      const normalized = normalizeProfile(data);
      setProfile(normalized);
      setError(null);
      return normalized;
    } catch (err) {
      if (isSessionExpiredError(err)) {
        setError(SESSION_EXPIRED_MESSAGE);
        setProfile(null);
        setStatus("unauthenticated");
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        return null;
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function restore() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;

        if (data.session) {
          setSession(data.session);
          try {
            const me = await refreshProfile(data.session.access_token);
            if (active && me) {
              setStatus("authenticated");
            }
          } catch {
            if (active) {
              setStatus("authenticated");
            }
          }
        } else {
          setSession(null);
          setProfile(null);
          setStatus("unauthenticated");
        }
      } finally {
        // no-op
      }
    }

    restore();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        setError(null);
        setStatus("unauthenticated");
        return;
      }

      if (nextSession) {
        setSession(nextSession);
        setStatus("authenticated");
        refreshProfile(nextSession.access_token).catch(() => {});
      }
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, [refreshProfile]);

  const signIn = useCallback(
    async (email, password) => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        return { ok: false, error: "Email or password is incorrect. Please try again." };
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        return { ok: false, error: "Complete the email confirmation, then log in." };
      }

      setSession(data.session);
      setStatus("authenticated");
      setError(null);
      try {
        await refreshProfile(data.session.access_token);
      } catch {
        setError("We could not load your account details.");
      }
      return { ok: true };
    },
    [refreshProfile],
  );

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setSession(null);
    setProfile(null);
    setError(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo(
    () => ({
      session,
      profile,
      status,
      error,
      signIn,
      signOut,
      refreshProfile,
    }),
    [session, profile, status, error, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}