import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

function NavLinkItem({ to, children, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => (isActive ? "active" : undefined)}>
      {children}
    </NavLink>
  );
}

function RoleNav({ role }) {
  if (role === "farm_admin") {
    return (
      <nav className="app-nav" aria-label="Main">
        <NavLinkItem to="/admin" end>
          Dashboard
        </NavLinkItem>
        <NavLinkItem to="/admin/farmers">Farmers</NavLinkItem>
        <NavLinkItem to="/admin/diagnostics">Diagnostics</NavLinkItem>
        <NavLinkItem to="/admin/messages">Messages</NavLinkItem>
      </nav>
    );
  }

  return (
    <nav className="app-nav" aria-label="Main">
      <NavLinkItem to="/home" end>
        Home
      </NavLinkItem>
      <NavLinkItem to="/diagnose">Diagnose</NavLinkItem>
      <NavLinkItem to="/history">History</NavLinkItem>
    </nav>
  );
}

function AppHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  const home = profile?.role === "farm_admin" ? "/admin" : "/home";

  return (
    <header className="app-header">
      <div className="app-header-row">
        <Link to={home} className="app-title">
          Plant-GAI-AI
        </Link>
        {profile && (
          <>
            <RoleNav role={profile.role} />
            <button type="button" className="app-logout" onClick={handleLogout}>
              Log out
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export default AppHeader;