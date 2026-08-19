import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useDevPreview } from "../preview/devPreview";
import Logo from "../components/ui/Logo";
import Button from "../components/ui/Button";
import FormField from "../components/ui/FormField";

function LoginPage() {
  const { signIn } = useAuth();
  const { enabled, previewRole, enterPreview, exitPreview } = useDevPreview();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    navigate("/", { replace: true });
  }

  function handleEnterPreview(role) {
    enterPreview(role);
    navigate("/", { replace: true });
  }

  return (
    <section className="auth-shell" aria-label="Log in">
      <div className="auth-card">
        <Logo />
        <h1>Log in</h1>
        <p className="auth-subtitle">Log in to keep caring for your plants.</p>

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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>

          {error && (
            <p className="form-error form-message" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" block disabled={submitting}>
            {submitting ? "Logging in..." : "Log in"}
          </Button>
        </form>

        <p className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <span className="auth-links-sep"> · </span>
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>

      {enabled && (
        <aside className="dev-preview-card" aria-label="Development UI Preview">
          <h3>Development UI Preview</h3>
          <p>This mode is for local UI inspection only. It does not authenticate you.</p>
          {previewRole ? (
            <button type="button" className="btn btn-light-outline" onClick={exitPreview}>
              Exit Preview
            </button>
          ) : (
            <div className="dev-preview-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => handleEnterPreview("farm_admin")}
              >
                Farm Admin
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => handleEnterPreview("farmer")}
              >
                Farmer
              </button>
            </div>
          )}
        </aside>
      )}
    </section>
  );
}

export default LoginPage;