import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useDevPreview } from "../../preview/devPreview";
import { fetchDiagnosis } from "../../api/diagnosis";
import PageHeader from "../../components/ui/PageHeader";
import CropThumb from "../../components/ui/CropThumb";
import StatusBadge from "../../components/ui/StatusBadge";
import { ErrorState, LoadingState } from "../../components/ui/States";
import { getClassInfo } from "../../data/crops";
import { formatDateTime } from "../../data/dates";
import { devFarmDiagnosisById } from "../../data/devMocks";

function AdminDiagnosisDetailPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const { previewRole } = useDevPreview();
  const isPreview = previewRole === "farm_admin";
  const [diagnosis, setDiagnosis] = useState(isPreview ? devFarmDiagnosisById(id) : null);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (isPreview) return;
    setDiagnosis(null);
    setError(null);
    setNotFound(false);
    try {
      setDiagnosis(await fetchDiagnosis(id, session?.access_token));
    } catch (err) {
      if (err?.status === 404) setNotFound(true);
      else setError(err?.message ?? "We could not load that diagnosis.");
    }
  }, [id, isPreview, session?.access_token]);

  useEffect(() => {
    load();
  }, [load]);

  if (notFound || (isPreview && !diagnosis)) {
    return (
      <>
        <PageHeader title="Diagnosis" />
        <ErrorState message="We could not find that diagnosis.">
          <Link to="/admin/diagnostics" className="btn btn-outline">
            Back to Diagnostics
          </Link>
        </ErrorState>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Diagnosis" />
        <ErrorState message={error} onRetry={load}>
          <Link to="/admin/diagnostics" className="btn btn-outline">
            Back to Diagnostics
          </Link>
        </ErrorState>
      </>
    );
  }

  if (!diagnosis) return <LoadingState message="Loading diagnosis..." />;

  const info = getClassInfo(diagnosis.disease ?? diagnosis.className);
  const farmerName = diagnosis.farmer_name ?? diagnosis.farmer;
  const confidence = diagnosis.confidence <= 1
    ? Math.round(diagnosis.confidence * 100)
    : diagnosis.confidence;
  const createdAt = diagnosis.created_at ?? diagnosis.scannedAt;

  return (
    <div aria-label="Diagnosis details">
      <PageHeader
        title="Diagnosis Details"
        subtitle={`For ${farmerName}`}
        actions={
          <Link to="/admin/diagnostics" className="btn btn-outline">
            Back to Diagnostics
          </Link>
        }
      />

      <div className="dash-card">
        <div className="result-head">
          <CropThumb crop={info.crop} size="lg" />
          <div>
            <p className="result-crop">{info.crop}</p>
            <StatusBadge status={info.healthy ? "healthy" : "sick"} />
          </div>
        </div>

        <h1 className="result-disease">{info.diseaseDisplay}</h1>
        <p className="result-confidence">
          {confidence}% Confidence • {formatDateTime(createdAt)}
        </p>

        <div className="detail-grid">
          <div className="result-section">
            <h3>Farmer</h3>
            <p>{farmerName}</p>
          </div>
          <div className="result-section">
            <h3>Crop</h3>
            <p>{info.crop}</p>
          </div>
        </div>

        <div className="result-section">
          <h3>What this means</h3>
          <p>{info.whatThisMeans}</p>
        </div>

        <div className="result-section">
          <h3>Recommended action</h3>
          <p>{info.whatYouCanDo}</p>
        </div>
      </div>
    </div>
  );
}

export default AdminDiagnosisDetailPage;