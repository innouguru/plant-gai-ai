import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useDevPreview, DevPreviewBanner } from "../preview/devPreview";
import Logo from "../components/ui/Logo";
import Icon from "../components/ui/Icon";
import Avatar from "../components/ui/Avatar";

const NAV_ITEMS = [
  { to: "/home", end: true, icon: "home", label: "Home" },
  { to: "/diagnose", end: true, icon: "camera", label: "Diagnose" },
  { to: "/history", end: true, icon: "history", label: "History" },
  { to: "/messages", end: true, icon: "messages", label: "Messages" },
];

function FarmerShell() {
  const { profile, signOut } = useAuth();
  const { previewRole, previewProfile } = useDevPreview();
  const navigate = useNavigate();

  const displayProfile = previewRole ? previewProfile : profile;
  const displayName = displayProfile?.fullName ?? displayProfile?.email;

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="farmer-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="farmer-header">
        <Link to="/home" className="brand-link" aria-label="Plant-GAI-AI home">
          <Logo compact />
        </Link>
        <div className="farmer-header-actions">
          <Avatar name={displayName} />
          <button type="button" className="farmer-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <main id="main-content" className="farmer-content" tabIndex={-1}>
        <DevPreviewBanner />
        <Outlet />
      </main>

      <nav className="farmer-nav" aria-label="Main">
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
    </div>
  );
}

export default FarmerShell;