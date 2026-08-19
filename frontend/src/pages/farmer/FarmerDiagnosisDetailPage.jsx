import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { fetchDiagnosis } from "../../api/diagnosis";
import DiagnosisResult from "../../components/diagnosis/DiagnosisResult";
import { ErrorState, LoadingState } from "../../components/ui/States";

function BackToHistory() {
  return (
    <Link to="/history" className="btn btn-outline">
      Back to History
    </Link>
  );
}

function FarmerDiagnosisDetailPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const [item, setItem] = useState(null);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setNotFound(false);
    setItem(null);
    try {
      const data = await fetchDiagnosis(id, session?.access_token);
      setItem(data);
    } catch (err) {
      if (err?.status === 404) {
        setNotFound(true);
      } else {
        setError(err?.message ?? "We could not load this diagnosis.");
      }
    }
  }, [id, session?.access_token]);

  useEffect(() => {
    load();
  }, [load]);

  if (notFound) {
    return (
      <ErrorState message="We could not find that diagnosis.">
        <BackToHistory />
      </ErrorState>
    );
  }

  if (error) {
    return (
      <ErrorState message={error} onRetry={load}>
        <BackToHistory />
      </ErrorState>
    );
  }

  if (item === null) {
    return <LoadingState message="Loading diagnosis..." />;
  }

  const diagnosis = {
    className: item.disease,
    confidence: Math.round(item.confidence * 100),
    scannedAt: item.created_at,
  };

  return (
    <section aria-label="Diagnosis details">
      <div className="detail-topbar">
        <Link to="/history" className="section-link">
          ← Back to History
        </Link>
      </div>
      <DiagnosisResult diagnosis={diagnosis} imageUrl={null} />
      <div className="aspect-result-actions">
        <Link to="/diagnose" className="btn btn-primary btn-block">
          Diagnose another plant
        </Link>
      </div>
    </section>
  );
}

export default FarmerDiagnosisDetailPage;