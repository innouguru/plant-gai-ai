import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useDevPreview } from "../../preview/devPreview";
import { fetchHistory } from "../../api/diagnosis";
import Icon from "../../components/ui/Icon";
import DiagnosisCard from "../../components/ui/DiagnosisCard";
import { devFarmerDiagnoses } from "../../data/devMocks";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";

export function buildFirstName(profile) {
  const name = profile?.fullName || profile?.email || "farmer";
  return name.split(" ")[0];
}

function FarmerHomePage() {
  const { profile, session } = useAuth();
  const { previewRole, previewProfile } = useDevPreview();
  const displayProfile = previewRole ? previewProfile : profile;
  const firstName = buildFirstName(displayProfile);
  const isPreview = previewRole === "farmer";
  const [recent, setRecent] = useState(isPreview ? devFarmerDiagnoses[0] : null);
  const [loading, setLoading] = useState(!isPreview);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isPreview || !session?.access_token) return;
    let active = true;
    fetchHistory(session.access_token)
      .then((items) => { if (active) setRecent(items[0] ?? null); })
      .catch((err) => { if (active) setError(err?.message ?? "Could not load your recent diagnosis."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.access_token, isPreview]);

  return (
    <div className="farmer-home">
      <h1 className="home-greeting">A kuabo, {firstName}!</h1>
      <p className="home-welcome">Welcome back. How are your crops doing today?</p>

      <div className="scan-card">
        <span className="scan-card-icon">
          <Icon name="camera" label="Diagnose plant disease" />
        </span>
        <h2>Diagnose Plant Disease</h2>
        <p>Take a quick photo to find diseases and treatment advice</p>
        <Link to="/diagnose" className="btn btn-accent btn-lg btn-block">
          Start Diagnostic Scan
          <Icon name="arrow" size={20} />
        </Link>
      </div>

      <div className="section-heading">
        <h2>Recent Diagnosis</h2>
        <Link to="/history" className="section-link">
          View Details
        </Link>
      </div>

      {loading ? <LoadingState message="Loading recent diagnosis..." /> : error ? (
        <ErrorState message={error} />
      ) : recent ? (
        <div className="diagnosis-list">
          <DiagnosisCard
            to={`/history/${recent.id}`}
            {...(recent.disease ? {
              className: recent.disease,
              confidence: Math.round(recent.confidence * 100),
              scannedAt: recent.created_at,
            } : recent)}
          />
        </div>
      ) : <EmptyState title="No diagnoses yet" message="Your latest diagnosis will appear here." />}

      <aside className="tip-card">
        <span className="tip-icon">
          <Icon name="tip" label="Tip" />
        </span>
        <div>
          <h3>Farming Tip of the Day</h3>
          <p>
            Always wash your farm tools after pruning sick plants to stop viruses
            spreading.
          </p>
        </div>
      </aside>
    </div>
  );
}

export default FarmerHomePage;