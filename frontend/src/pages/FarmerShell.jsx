import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useDevPreview, DevPreviewBanner } from "../preview/devPreview";
import Logo from "../components/ui/Logo";
import Icon from "../components/ui/Icon";
import Avatar from "../components/ui/Avatar";

const NAV_ITEMS = [
  { to: "/home", end: true, icon: "home", label: "Home" },
  { to: "/diagnose", end: true, icon: "camera", label: "Diagnose" },
  { to: "/history", end: true, icon: "history", label: "History" },
];

function FarmerShell() {
  const { profile } = useAuth();
  const { previewRole, previewProfile } = useDevPreview();

  const displayProfile = previewRole ? previewProfile : profile;
  const displayName = displayProfile?.fullName ?? displayProfile?.email;

  return (
    <div className="farmer-shell">
      <header className="farmer-header">
        <Link to="/home" className="brand-link" aria-label="Plant-GAI-AI home">
          <Logo compact />
        </Link>
        <Avatar name={displayName} />
      </header>

      <main className="farmer-content">
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