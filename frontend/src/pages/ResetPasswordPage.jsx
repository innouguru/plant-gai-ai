import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../auth/supabase";
import { getHashParams } from "../auth/hashParams";
import Logo from "../components/ui/Logo";
import Button from "../components/ui/Button";
import FormField from "../components/ui/FormField";

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState(null);

  const isRecoveryLink = getHashParams().get("type") === "recovery";

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError("We could not reset your password. Please try again.");
      return;
    }

    setUpdated(true);
  }

  if (!isRecoveryLink && !updated) {
    return (
      <section className="auth-shell" aria-label="Invalid reset link">
        <div className="auth-card">
          <Logo />
          <h2>Invalid link</h2>
          <p className="auth-subtitle">
            This password reset link is invalid or has expired.{" "}
            <Link to="/forgot-password">Request a new one</Link>.
          </p>
        </div>
      </section>
    );
  }

  if (updated) {
    return (
      <section className="auth-shell" aria-label="Password updated">
        <div className="auth-card">
          <Logo />
          <h2>Password updated</h2>
          <p className="form-success form-message" role="status">
            Your password has been updated. <Link to="/login">Log in</Link> with your new
            password.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-shell" aria-label="Set new password">
      <div className="auth-card">
        <Logo />
        <h2>Set a new password</h2>

        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField id="password" label="New password">
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

          <FormField id="confirmPassword" label="Confirm new password">
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
            {submitting ? "Updating..." : "Update password"}
          </Button>
        </form>
      </div>
    </section>
  );
}

export default ResetPasswordPage;