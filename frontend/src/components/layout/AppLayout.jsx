import AppHeader from "./AppHeader";

function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">{children}</main>
    </div>
  );
}

export default AppLayout;
