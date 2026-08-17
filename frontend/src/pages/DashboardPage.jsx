import { useEffect, useState } from "react";
import { fetchHealth } from "../api/health";

function DashboardPage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    fetchHealth()
      .then((data) => {
        if (active) {
          setHealth(data);
        }
      })
      .catch(() => {
        if (active) {
          setError("Backend is not reachable");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="dashboard" aria-label="Dashboard">
      <h2>Dashboard</h2>
      <p className="dashboard-hint">
        Welcome to Plant-GAI-AI. Plant disease diagnosis is coming in a future phase.
      </p>

      <div className="health-card">
        <h3>API status</h3>
        {health ? (
          <p className="status-ok">Connected: {health.message}</p>
        ) : error ? (
          <p className="status-error">{error}</p>
        ) : (
          <p className="status-loading">Checking...</p>
        )}
      </div>
    </section>
  );
}

export default DashboardPage;
