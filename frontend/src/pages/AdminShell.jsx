import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useDevPreview, DevPreviewBanner } from "../preview/devPreview";
import Logo from "../components/ui/Logo";
import Icon from "../components/ui/Icon";

const NAV_ITEMS = [
  { to: "/admin", end: true, icon: "dashboard", label: "Dashboard" },
  { to: "/admin/farmers", end: true, icon: "users", label: "Farmers" },
  { to: "/admin/diagnostics", end: true, icon: "diagnostics", label: "Diagnostics" },
  { to: "/admin/messages", end: true, icon: "messages", label: "Messages" },
];

function AdminShell() {
  const { profile, signOut } = useAuth();
  const { previewRole, previewProfile, exitPreview } = useDevPreview();
  const navigate = useNavigate();

  const displayProfile = previewRole ? previewProfile : profile;

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  function handleExitPreview() {
    exitPreview();
    navigate("/login", { replace: true });
  }

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Logo inverse />
        </div>

        <nav className="admin-nav" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <strong>{displayProfile?.farm?.name ?? "Your farm"}</strong>
          <span>{displayProfile?.email}</span>
          {previewRole ? (
            <button type="button" className="admin-logout" onClick={handleExitPreview}>
              Exit preview
            </button>
          ) : (
            <button type="button" className="admin-logout" onClick={handleLogout}>
              Log out
            </button>
          )}
        </div>
      </aside>

      <main id="main-content" className="admin-main" tabIndex={-1}>
        <div className="admin-content">
          <DevPreviewBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AdminShell;