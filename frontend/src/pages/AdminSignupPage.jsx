import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../auth/supabase";
import { useAuth } from "../auth/AuthContext";
import { completeOnboarding } from "../api/onboarding";
import Logo from "../components/ui/Logo";
import Button from "../components/ui/Button";
import FormField from "../components/ui/FormField";

function AdminSignupPage() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [farmName, setFarmName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError("We could not create your account. The email may already be registered.");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError("Check your email to confirm your account, then log in.");
        return;
      }

      await completeOnboarding(farmName, data.session.access_token);
      await refreshProfile(data.session.access_token);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err?.message ?? "We could not set up your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-shell" aria-label="Create an account">
      <div className="auth-card">
        <Logo />
        <h2>Create an account</h2>
        <p className="auth-subtitle">Set up your farm to get started with Plant-GAI-AI.</p>

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

          <FormField id="farmName" label="Farm name">
            <input
              id="farmName"
              type="text"
              required
              minLength={2}
              maxLength={120}
              value={farmName}
              onChange={(event) => setFarmName(event.target.value)}
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

        <p className="auth-links">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </section>
  );
}

export default AdminSignupPage;