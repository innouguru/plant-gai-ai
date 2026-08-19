import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../auth/supabase";
import Logo from "../components/ui/Logo";
import Button from "../components/ui/Button";
import FormField from "../components/ui/FormField";

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
        <Logo />
        <h1>Reset your password</h1>

        {sent ? (
          <p className="form-success form-message" role="status">
            Check your email for a link to reset your password.
          </p>
        ) : (
          <>
            <p className="auth-subtitle">
              Enter your email and we'll send you a link to reset your password.
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <FormField id="email" label="Email">
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </FormField>

              {error && (
                <p className="form-error form-message" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" variant="primary" block disabled={submitting}>
                {submitting ? "Sending link..." : "Send reset link"}
              </Button>
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