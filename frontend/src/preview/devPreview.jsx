// ---------------------------------------------------------------------------
// DEVELOPMENT-ONLY UI PREVIEW MODE
//
// Lets a developer inspect the approved farmer and admin screens locally
// without a Supabase account. This is display scaffolding only:
//   - Guarded by import.meta.env.DEV, so production builds never activate it.
//   - Never creates a Supabase session and never calls supabase.auth.
//   - Never modifies backend auth/authorization. Real login, signup, invite,
//     and role checks are untouched.
// The preview role is persisted in a clearly namespaced localStorage key,
// read back on refresh, and cleared when preview is exited.
// ---------------------------------------------------------------------------

import { createContext, useContext, useMemo, useState } from "react";

export const DEV_PREVIEW_ROLE_KEY = "plant-gai-ai-dev-preview-role";
export const PREVIEW_ROLES = ["farm_admin", "farmer"];
export const PREVIEW_ROLE_LABELS = { farm_admin: "Farm Admin", farmer: "Farmer" };

export function isPreviewEnabled() {
  return import.meta.env.DEV;
}

export function readPreviewRole() {
  if (!isPreviewEnabled()) {
    return null;
  }
  try {
    const value = window.localStorage.getItem(DEV_PREVIEW_ROLE_KEY);
    return PREVIEW_ROLES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function writePreviewRole(role) {
  if (!isPreviewEnabled()) {
    return;
  }
  try {
    if (role) {
      window.localStorage.setItem(DEV_PREVIEW_ROLE_KEY, role);
    } else {
      window.localStorage.removeItem(DEV_PREVIEW_ROLE_KEY);
    }
  } catch {
    // ignore storage errors; preview keeps working for this session
  }
}

// Clearly fake profiles used only for display within preview mode.
export const PREVIEW_ADMIN_PROFILE = {
  id: "preview-admin",
  email: "admin-preview@plant-gai-ai.local",
  fullName: "Preview Admin",
  role: "farm_admin",
  farmId: "preview-farm",
  farm: { id: "preview-farm", name: "Green Valley Farm" },
  requiresOnboarding: false,
};

export const PREVIEW_FARMER_PROFILE = {
  id: "preview-farmer",
  email: "farmer-preview@plant-gai-ai.local",
  fullName: "Amina Preview",
  role: "farmer",
  farmId: null,
  farm: null,
  requiresOnboarding: false,
};

const DevPreviewContext = createContext(null);

export function useDevPreview() {
  const context = useContext(DevPreviewContext);
  if (context) {
    return context;
  }
  // Safe default when no DevPreviewProvider is mounted (e.g. production or
  // tests that render a subtree without the provider).
  return {
    enabled: isPreviewEnabled(),
    previewRole: null,
    previewProfile: null,
    enterPreview: () => {},
    exitPreview: () => {},
  };
}

export function DevPreviewProvider({ children }) {
  const [previewRole, setPreviewRole] = useState(readPreviewRole);

  const enterPreview = (role) => {
    if (!isPreviewEnabled() || !PREVIEW_ROLES.includes(role)) {
      return;
    }
    writePreviewRole(role);
    setPreviewRole(role);
  };

  const exitPreview = () => {
    writePreviewRole(null);
    setPreviewRole(null);
  };

  const previewProfile = previewRole === "farm_admin" ? PREVIEW_ADMIN_PROFILE : PREVIEW_FARMER_PROFILE;

  const value = useMemo(
    () => ({
      enabled: isPreviewEnabled(),
      previewRole,
      previewProfile: previewRole ? previewProfile : null,
      enterPreview,
      exitPreview,
    }),
    [previewRole, previewProfile],
  );

  return <DevPreviewContext.Provider value={value}>{children}</DevPreviewContext.Provider>;
}

export function DevPreviewBanner() {
  const { previewRole, exitPreview } = useDevPreview();

  if (!previewRole || !isPreviewEnabled()) {
    return null;
  }

  const roleLabel = PREVIEW_ROLE_LABELS[previewRole] ?? previewRole;

  return (
    <div className="dev-preview-banner" role="status">
      <div className="dev-preview-banner-text">
        <strong>Development preview — {roleLabel}</strong>
        <span>Local UI inspection only. Not authenticated; no real data or actions.</span>
      </div>
      <button type="button" className="btn dev-preview-exit" onClick={exitPreview}>
        Exit preview
      </button>
    </div>
  );
}