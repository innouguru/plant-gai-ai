import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export const LOADING_TEXT = "Checking your account...";

function LoadingScreen() {
  return <p className="status-loading">{LOADING_TEXT}</p>;
}

function ProfileLoadError({ onRetry }) {
  return (
    <div className="profile-error-card" role="alert">
      <p>We could not load your account details.</p>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function ProtectedRoute() {
  const { status, profile, session, refreshProfile } = useAuth();

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

  if (!profile || profile.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function HomeRedirect() {
  const { status, profile } = useAuth();

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