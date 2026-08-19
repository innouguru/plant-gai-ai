import { Link, useParams } from "react-router-dom";
import DiagnosisResult from "../../components/diagnosis/DiagnosisResult";
import { devFarmerDiagnosisById } from "../../data/devMocks";
import { ErrorState } from "../../components/ui/States";

function FarmerDiagnosisDetailPage() {
  const { id } = useParams();
  const diagnosis = devFarmerDiagnosisById(id);

  if (!diagnosis) {
    return (
      <ErrorState message="We could not find that diagnosis.">
        <Link to="/history" className="btn btn-outline">
          Back to History
        </Link>
      </ErrorState>
    );
  }

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