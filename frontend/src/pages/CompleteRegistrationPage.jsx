import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../auth/supabase";
import { useAuth } from "../auth/AuthContext";
import { getHashParams } from "../auth/hashParams";
import { acceptInvitation } from "../api/invitations";
import { LOADING_TEXT } from "../routing/ProtectedRoutes";
import Logo from "../components/ui/Logo";
import Button from "../components/ui/Button";
import FormField from "../components/ui/FormField";

function CompleteRegistrationPage() {
  const { status, session, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isInviteLink = getHashParams().get("type") === "invite";

  useEffect(() => {
    if (status !== "authenticated" || !session || !profile) return;
    if (!profile.requiresOnboarding) {
      navigate("/", { replace: true });
    }
  }, [status, session, profile, navigate]);

  if (status === "loading") {
    return <p className="status-loading">{LOADING_TEXT}</p>;
  }

  if (!session && !isInviteLink) {
    return (
      <section className="auth-shell" aria-label="Invalid invitation">
        <div className="auth-card">
          <Logo />
          <h1>Invitation not found</h1>
          <p className="auth-subtitle">
            This invitation link is invalid or has expired. Ask the farm admin to send a new
            invitation.
          </p>
        </div>
      </section>
    );
  }

  if (session && !profile) {
    return <p className="status-loading">Setting up your account...</p>;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("We could not set your password. Please try again.");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError("Your session ended. Please open the invitation link again.");
        return;
      }

      await acceptInvitation(fullName.trim(), data.session.access_token);
      await refreshProfile(data.session.access_token);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.message ?? "We could not complete your registration. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-shell" aria-label="Complete registration">
      <div className="auth-card">
        <Logo />
        <h1>Finish creating your account</h1>
        <p className="auth-subtitle">
          You've been invited to join a farm. Set your password to get started.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField id="fullName" label="Full name">
            <input
              id="fullName"
              type="text"
              required
              maxLength={120}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </FormField>

          <FormField id="password" label="Password">
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>

          <FormField id="confirmPassword" label="Confirm password">
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </FormField>

          {error && (
            <p className="form-error form-message" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" block disabled={submitting}>
            {submitting ? "Creating account..." : "Create account"}
          </Button>
        </form>
      </div>
    </section>
  );
}

export default CompleteRegistrationPage;