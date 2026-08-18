import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../auth/supabase";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);

    if (resetError) {
      setError("We could not send a reset link. Please try again.");
      return;
    }

    setSent(true);
  }

  return (
    <section className="auth-shell" aria-label="Reset password">
      <div className="auth-card">
        <h2>Reset your password</h2>

        {sent ? (
          <p className="form-success" role="status">
            Check your email for a link to reset your password.
          </p>
        ) : (
          <>
            <p className="auth-subtitle">
              Enter your email and we'll send you a link to reset your password.
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" disabled={submitting}>
                {submitting ? "Sending link..." : "Send reset link"}
              </button>
            </form>
          </>
        )}

        <p className="auth-links">
          Remembered your password? <Link to="/login">Log in</Link>
        </p>
      </div>
    </section>
  );
}

export default ForgotPasswordPage;