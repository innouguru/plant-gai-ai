import { useAuth } from "../../auth/AuthContext";

function AdminDashboardPage() {
  const { profile } = useAuth();
  const farmName = profile?.farm?.name ?? "your farm";

  return (
    <section className="dashboard" aria-label="Admin dashboard">
      <h2>Dashboard</h2>
      <p className="dashboard-hint">
        Manage <strong>{farmName}</strong>. Farm activity and diagnostics will appear here
        in a future phase.
      </p>
    </section>
  );
}

export default AdminDashboardPage;