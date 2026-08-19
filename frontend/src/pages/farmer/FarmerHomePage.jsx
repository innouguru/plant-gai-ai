import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useDevPreview } from "../../preview/devPreview";
import Icon from "../../components/ui/Icon";
import DiagnosisCard from "../../components/ui/DiagnosisCard";
import { devFarmerDiagnoses } from "../../data/devMocks";

export function buildFirstName(profile) {
  const name = profile?.fullName || profile?.email || "farmer";
  return name.split(" ")[0];
}

function FarmerHomePage() {
  const { profile } = useAuth();
  const { previewRole, previewProfile } = useDevPreview();
  const displayProfile = previewRole ? previewProfile : profile;
  const firstName = buildFirstName(displayProfile);
  const recent = devFarmerDiagnoses[0];

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

      <div className="diagnosis-list">
        <DiagnosisCard to={`/history/${recent.id}`} {...recent} />
      </div>

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