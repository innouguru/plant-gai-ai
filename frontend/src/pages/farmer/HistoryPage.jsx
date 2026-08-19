import DiagnosisCard from "../../components/ui/DiagnosisCard";
import { EmptyState } from "../../components/ui/States";
import { devFarmerDiagnoses } from "../../data/devMocks";

function HistoryPage() {
  if (devFarmerDiagnoses.length === 0) {
    return (
      <EmptyState title="No diagnoses yet">
        <p>Scans you run will appear here so you can review them any time.</p>
      </EmptyState>
    );
  }

  return (
    <section aria-label="Diagnosis history">
      <div className="page-title">
        <h1>History</h1>
        <p>Your past plant diagnoses.</p>
      </div>
      <div className="diagnosis-list">
        {devFarmerDiagnoses.map((entry) => (
          <DiagnosisCard key={entry.id} to={`/history/${entry.id}`} {...entry} />
        ))}
      </div>
    </section>
  );
}

export default HistoryPage;