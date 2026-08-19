import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useDevPreview } from "../../preview/devPreview";
import { fetchFarmStatistics } from "../../api/farms";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Icon from "../../components/ui/Icon";
import CropThumb from "../../components/ui/CropThumb";
import StatusBadge from "../../components/ui/StatusBadge";
import { LoadingState, ErrorState, EmptyState } from "../../components/ui/States";
import { getClassInfo } from "../../data/crops";
import { formatRelativeTime } from "../../data/dates";
import { devAdminStats, devRecentFarmDiagnoses, devTopCrops } from "../../data/devMocks";

function AdminDashboardPage() {
  const { profile, session } = useAuth();
  const { previewRole, previewProfile } = useDevPreview();
  const isPreview = previewRole === "farm_admin";
  const farmId = profile?.farmId;
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(!isPreview);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isPreview || !farmId || !session?.access_token) return;

    let active = true;
    setLoading(true);
    setError(null);

    fetchFarmStatistics(farmId, session.access_token)
      .then((data) => {
        if (active) setStatistics(data);
      })
      .catch((err) => {
        if (active) setError(err?.message ?? "Could not load farm statistics.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [farmId, session?.access_token, isPreview]);

  if (!isPreview && !farmId) return null;

  const farmName = isPreview
    ? previewProfile?.farm?.name ?? "Green Valley Farm"
    : profile?.farm?.name;
  const stats = isPreview ? devAdminStats : statistics;
  const recentDiagnoses = isPreview ? devRecentFarmDiagnoses : statistics?.recent_diagnoses ?? [];
  const cropCounts = isPreview
    ? devTopCrops.map(({ crop, percent }) => ({ crop, count: percent }))
    : Object.entries(statistics?.crop_counts ?? {}).map(([crop, count]) => ({ crop, count }));
  const totalDiagnoses = stats?.total_diagnoses ?? stats?.diagnosesRun ?? 0;
  const identifiedDiseases = isPreview
    ? stats.identifiedDiseases
    : Object.keys(statistics?.disease_counts ?? {}).filter((disease) => !getClassInfo(disease).healthy).length;
  const cropTotal = cropCounts.reduce((sum, item) => sum + item.count, 0);

  return (
    <div aria-label="Admin dashboard">
      <PageHeader
        title={farmName}
        subtitle="Welcome back, administrator. Here is an overview of crop health and registered farmers."
      />

      <div className="stat-grid">
        <StatCard
          label="Total Farmers"
          value={stats?.farmer_count ?? stats?.totalFarmers ?? 0}
        />
        <StatCard
          label="Diagnoses Run"
          value={totalDiagnoses}
        />
        <StatCard
          label="Identified Diseases"
          value={identifiedDiseases}
        />
      </div>

      {loading ? (
        <LoadingState message="Loading farm statistics..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <div className="dash-grid">
          <section className="dash-card" aria-label="Recent diagnoses">
            <h2>Recent Diagnoses</h2>
            {recentDiagnoses.length === 0 ? (
              <EmptyState title="No diagnoses yet" message="Recent farm diagnoses will appear here." />
            ) : recentDiagnoses.map((entry) => {
              const className = entry.disease ?? entry.className;
              const info = getClassInfo(className);
              const farmer = entry.farmer_name ?? entry.farmer;
              const scannedAt = entry.created_at ?? entry.scannedAt;
              return (
                <Link to={`/admin/diagnostics/${entry.id}`} className="diag-row" key={entry.id}>
                  <CropThumb crop={info.crop} />
                  <div className="diag-row-main">
                    <p className="diag-row-title">{farmer} — {info.crop}</p>
                    <p className="diag-row-sub">
                      {info.diseaseDisplay} • {formatRelativeTime(scannedAt)}
                    </p>
                  </div>
                  <StatusBadge status={info.healthy ? "healthy" : "sick"} />
                </Link>
              );
            })}
          </section>

          <div>
            <section className="quick-actions-card" aria-label="Quick actions">
              <h2>Quick Actions</h2>
              <div className="quick-actions">
                <Link to="/admin/farmers" className="btn btn-accent">
                  <Icon name="users" />
                  Invite New Farmer
                </Link>
                <Link to="/admin/report" className="btn btn-light-outline">
                  <Icon name="print" />
                  Generate Farm Report
                </Link>
              </div>
            </section>

            <section className="dash-card" aria-label="Top crops scanned">
              <h2>Top Crops Scanned</h2>
              {cropCounts.length === 0 ? (
                <EmptyState title="No crops scanned yet" message="Crop activity will appear here after diagnoses." />
              ) : (
                <div className="crop-progress">
                  {cropCounts.slice(0, 5).map((item) => {
                    const percent = isPreview ? item.count : Math.round((item.count / cropTotal) * 100);
                    return (
                      <div className="crop-progress-row" key={item.crop}>
                        <span className="crop-progress-label">{item.crop}</span>
                        <span className="crop-progress-track" aria-hidden="true">
                          <span className="crop-progress-fill" style={{ width: `${percent}%` }} />
                        </span>
                        <span className="crop-progress-value">{percent}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboardPage;