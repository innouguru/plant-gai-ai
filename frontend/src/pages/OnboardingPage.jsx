import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { completeOnboarding } from "../api/onboarding";
import { LOADING_TEXT } from "../routing/ProtectedRoutes";

function OnboardingPage() {
  const { status, profile, session, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [farmName, setFarmName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (status === "loading") {
    return <p className="status-loading">{LOADING_TEXT}</p>;
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  if (profile && !profile.requiresOnboarding) {
    return <Navigate to={profile.role === "farm_admin" ? "/admin" : "/home"} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await completeOnboarding(farmName, session.access_token);
      await refreshProfile(session.access_token);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err?.message ?? "We could not set up your farm. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-shell" aria-label="Set up your farm">
      <div className="auth-card">
        <h2>Welcome to Plant-GAI-AI</h2>
        <p className="auth-subtitle">Create a farm to finish setting up your account.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="farmName">Farm name</label>
          <input
            id="farmName"
            type="text"
            required
            minLength={2}
            maxLength={120}
            value={farmName}
            onChange={(event) => setFarmName(event.target.value)}
          />

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? "Creating farm..." : "Create farm"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default OnboardingPage;