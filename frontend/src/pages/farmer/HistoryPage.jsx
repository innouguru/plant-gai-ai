import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { fetchHistory } from "../../api/diagnosis";
import DiagnosisCard from "../../components/ui/DiagnosisCard";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";

export function normalizeHistoryItem(item) {
  return {
    id: item.id,
    className: item.disease,
    confidence: Math.round(item.confidence * 100),
    scannedAt: item.created_at,
  };
}

function HistoryPage() {
  const { session } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    setItems(null);
    try {
      const data = await fetchHistory(session?.access_token);
      setItems(data);
    } catch (err) {
      setError(err?.message ?? "We could not load your history.");
    }
  }, [session?.access_token]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  if (items === null) {
    return <LoadingState message="Loading your history..." />;
  }

  if (items.length === 0) {
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
        {items.map((entry) => (
          <DiagnosisCard key={entry.id} to={`/history/${entry.id}`} {...normalizeHistoryItem(entry)} />
        ))}
      </div>
    </section>
  );
}

export default HistoryPage;