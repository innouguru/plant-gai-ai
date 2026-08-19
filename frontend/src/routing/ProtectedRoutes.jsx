import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useDevPreview } from "../preview/devPreview";

export const LOADING_TEXT = "Checking your account...";

function LoadingScreen() {
  return <p className="status-loading">{LOADING_TEXT}</p>;
}

function ProfileLoadError({ onRetry }) {
  return (
    <div className="state-screen" role="alert">
      <h3 className="state-title">We could not load your account details.</h3>
      <button type="button" className="btn btn-outline" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function ProtectedRoute() {
  const { status, profile, session, refreshProfile } = useAuth();
  const { previewRole } = useDevPreview();

  // Development-only UI preview: admits the previewing role without requiring
  // a Supabase session. No-op in production builds (previewRole is always null).
  if (previewRole) {
    return <Outlet />;
  }

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return <ProfileLoadError onRetry={() => refreshProfile(session.access_token)} />;
  }

  if (profile.requiresOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

export function RequireRole({ role }) {
  const { profile } = useAuth();
  const { previewRole } = useDevPreview();

  // Dev-only preview role, otherwise the real profile role.
  const effectiveRole = previewRole ?? profile?.role;

  if (!effectiveRole || effectiveRole !== role) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function HomeRedirect() {
  const { status, profile } = useAuth();
  const { previewRole } = useDevPreview();

  if (previewRole === "farm_admin") {
    return <Navigate to="/admin" replace />;
  }

  if (previewRole === "farmer") {
    return <Navigate to="/home" replace />;
  }

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status !== "authenticated" || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (profile.requiresOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  if (profile.role === "farm_admin") {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/home" replace />;
}