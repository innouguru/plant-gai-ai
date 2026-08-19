import { Link, useParams } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader";
import CropThumb from "../../components/ui/CropThumb";
import StatusBadge from "../../components/ui/StatusBadge";
import { ErrorState } from "../../components/ui/States";
import { getClassInfo } from "../../data/crops";
import { formatDateTime } from "../../data/dates";
import { devFarmDiagnosisById } from "../../data/devMocks";

function AdminDiagnosisDetailPage() {
  const { id } = useParams();
  const diagnosis = devFarmDiagnosisById(id);

  if (!diagnosis) {
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

  const info = getClassInfo(diagnosis.className);

  return (
    <div aria-label="Diagnosis details">
      <PageHeader
        title="Diagnosis Details"
        subtitle={`For ${diagnosis.farmer}`}
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
          {diagnosis.confidence}% Confidence • {formatDateTime(diagnosis.scannedAt)}
        </p>

        <div className="detail-grid">
          <div className="result-section">
            <h3>Farmer</h3>
            <p>{diagnosis.farmer}</p>
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