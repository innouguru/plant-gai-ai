import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader";
import Icon from "../../components/ui/Icon";
import StatusBadge from "../../components/ui/StatusBadge";
import { EmptyState } from "../../components/ui/States";
import { getClassInfo } from "../../data/crops";
import { formatDateTime } from "../../data/dates";
import { devRecentFarmDiagnoses } from "../../data/devMocks";

function DiagnosticsPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return devRecentFarmDiagnoses.filter((entry) => {
      const info = getClassInfo(entry.className);
      if (filter !== "all") {
        const status = info.healthy ? "healthy" : "sick";
        if (status !== filter) return false;
      }
      if (!normalized) return true;
      const searchable = `${entry.farmer} ${info.crop} ${info.diseaseDisplay}`.toLowerCase();
      return searchable.includes(normalized);
    });
  }, [query, filter]);

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

      {rows.length === 0 ? (
        <EmptyState title="No diagnoses found" message="Try a different search or filter." />
      ) : (
        <div className="diag-table-wrap">
          <table className="diag-table">
            <thead>
              <tr>
                <th>Farmer</th>
                <th>Crop</th>
                <th>Diagnosis</th>
                <th>Status</th>
                <th>Confidence</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => {
                const info = getClassInfo(entry.className);
                return (
                  <tr key={entry.id} onClick={() => {}}>
                    <td>
                      <Link to={`/admin/diagnostics/${entry.id}`} className="table-link">
                        {entry.farmer}
                      </Link>
                    </td>
                    <td>{info.crop}</td>
                    <td>{info.diseaseDisplay}</td>
                    <td>
                      <StatusBadge status={info.healthy ? "healthy" : "sick"} />
                    </td>
                    <td>{entry.confidence}%</td>
                    <td>{formatDateTime(entry.scannedAt)}</td>
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