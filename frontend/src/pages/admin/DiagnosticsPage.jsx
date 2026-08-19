import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useDevPreview } from "../../preview/devPreview";
import { fetchFarmDiagnoses } from "../../api/farms";
import PageHeader from "../../components/ui/PageHeader";
import Icon from "../../components/ui/Icon";
import StatusBadge from "../../components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { getClassInfo } from "../../data/crops";
import { formatDateTime } from "../../data/dates";
import { devRecentFarmDiagnoses } from "../../data/devMocks";

function DiagnosticsPage() {
  const { profile, session } = useAuth();
  const { previewRole } = useDevPreview();
  const isPreview = previewRole === "farm_admin";
  const farmId = profile?.farmId;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [diagnoses, setDiagnoses] = useState(isPreview ? devRecentFarmDiagnoses : []);
  const [loading, setLoading] = useState(!isPreview);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isPreview || !farmId || !session?.access_token) return;

    let active = true;
    setLoading(true);
    setError(null);

    fetchFarmDiagnoses(farmId, session.access_token)
      .then((data) => {
        if (active) setDiagnoses(data);
      })
      .catch((err) => {
        if (active) setError(err?.message ?? "Could not load farm diagnoses.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [farmId, session?.access_token, isPreview]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return diagnoses.filter((entry) => {
      const info = getClassInfo(entry.disease ?? entry.className);
      if (filter !== "all") {
        const status = info.healthy ? "healthy" : "sick";
        if (status !== filter) return false;
      }
      if (!normalized) return true;
      const searchable = `${entry.farmer_name ?? entry.farmer} ${info.crop} ${info.diseaseDisplay}`.toLowerCase();
      return searchable.includes(normalized);
    });
  }, [diagnoses, query, filter]);

  if (!isPreview && !farmId) return null;

  return (
    <div aria-label="Diagnostics">
      <PageHeader
        title="Diagnostics"
        subtitle="Diagnoses recorded by farmers on this farm."
      />

      <div className="admin-toolbar">
        <div className="search-input">
          <Icon name="search" />
          <input
            type="search"
            placeholder="Search farmer, crop or disease"
            aria-label="Search diagnoses"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="statusFilter" className="visually-hidden">
            Filter by status
          </label>
          <select
            id="statusFilter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="healthy">Healthy</option>
            <option value="sick">Sick</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading diagnoses..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No diagnoses found" message="Try a different search or filter." />
      ) : (
        <div className="diag-table-wrap">
          <table className="diag-table">
            <thead>
              <tr>
                <th scope="col">Farmer</th>
                <th scope="col">Crop</th>
                <th scope="col">Diagnosis</th>
                <th scope="col">Status</th>
                <th scope="col">Confidence</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => {
                const info = getClassInfo(entry.disease ?? entry.className);
                const farmerName = entry.farmer_name ?? entry.farmer;
                const confidence = entry.confidence <= 1
                  ? Math.round(entry.confidence * 100)
                  : entry.confidence;
                return (
                  <tr key={entry.id} onClick={() => {}}>
                    <td>
                      <Link to={`/admin/diagnostics/${entry.id}`} className="table-link">
                        {farmerName}
                      </Link>
                    </td>
                    <td>{info.crop}</td>
                    <td>{info.diseaseDisplay}</td>
                    <td>
                      <StatusBadge status={info.healthy ? "healthy" : "sick"} />
                    </td>
                    <td>{confidence}%</td>
                    <td>{formatDateTime(entry.created_at ?? entry.scannedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DiagnosticsPage;