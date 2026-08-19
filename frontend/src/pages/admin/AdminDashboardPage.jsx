import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Icon from "../../components/ui/Icon";
import CropThumb from "../../components/ui/CropThumb";
import StatusBadge from "../../components/ui/StatusBadge";
import { getClassInfo } from "../../data/crops";
import { formatRelativeTime } from "../../data/dates";
import { devAdminStats, devRecentFarmDiagnoses, devTopCrops } from "../../data/devMocks";

function AdminDashboardPage() {
  const { profile } = useAuth();
  const farmName = profile?.farm?.name ?? "Green Valley Farm";

  return (
    <div aria-label="Admin dashboard">
      <PageHeader
        title={farmName}
        subtitle="Welcome back, administrator. Here is an overview of crop health and registered farmers."
      />

      <div className="stat-grid">
        <StatCard
          label="Total Farmers"
          value={devAdminStats.totalFarmers}
          trend="+12% this week"
          trendTone="healthy"
        />
        <StatCard
          label="Diagnoses Run"
          value={devAdminStats.diagnosesRun}
          trend="87% accuracy"
          trendTone="muted"
        />
        <StatCard
          label="Identified Diseases"
          value={devAdminStats.identifiedDiseases}
          trend="Alert: CMD active"
          trendTone="alert"
        />
      </div>

      <div className="dash-grid">
        <section className="dash-card" aria-label="Recent diagnoses">
          <h2>Recent Diagnoses</h2>
          {devRecentFarmDiagnoses.map((entry) => {
            const info = getClassInfo(entry.className);
            return (
              <Link to={`/admin/diagnostics/${entry.id}`} className="diag-row" key={entry.id}>
                <CropThumb crop={info.crop} />
                <div className="diag-row-main">
                  <p className="diag-row-title">{entry.farmer} — {info.crop}</p>
                  <p className="diag-row-sub">
                    {info.diseaseDisplay} • {formatRelativeTime(entry.scannedAt)}
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
            <div className="crop-progress">
              {devTopCrops.map((item) => (
                <div className="crop-progress-row" key={item.crop}>
                  <span className="crop-progress-label">{item.crop}</span>
                  <span className="crop-progress-track" aria-hidden="true">
                    <span className="crop-progress-fill" style={{ width: `${item.percent}%` }} />
                  </span>
                  <span className="crop-progress-value">{item.percent}%</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;