import { useAuth } from "../../auth/AuthContext";

function FarmerHomePage() {
  const { profile } = useAuth();
  const name = profile?.fullName || profile?.email;

  return (
    <section className="dashboard" aria-label="Home">
      <h2>Welcome{name ? `, ${name}` : ""}</h2>
      <p className="dashboard-hint">
        Plant-GAI-AI helps you diagnose plant diseases from leaf photos. Diagnosis is coming
        in a future phase.
      </p>

      <p className="dashboard-hint">
        Use <strong>Diagnose</strong> to check a leaf photo and <strong>History</strong> to see
        your past results.
      </p>
    </section>
  );
}

export default FarmerHomePage;