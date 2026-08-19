import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useDevPreview } from "../../preview/devPreview";
import { fetchFarmStatistics } from "../../api/farms";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import StatusBadge from "../../components/ui/StatusBadge";
import { getClassInfo } from "../../data/crops";
import { formatDate, formatDateTime } from "../../data/dates";
import { devFarmReport } from "../../data/devMocks";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";

function FarmReportPage() {
  const { profile, session } = useAuth();
  const { previewRole, previewProfile } = useDevPreview();
  const isPreview = previewRole === "farm_admin";
  const farmId = profile?.farmId;
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(!isPreview);
  const [error, setError] = useState(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString());

  useEffect(() => {
    if (isPreview || !farmId || !session?.access_token) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetchFarmStatistics(farmId, session.access_token)
      .then((data) => { if (active) setStatistics(data); })
      .catch((err) => { if (active) setError(err?.message ?? "Could not load farm statistics."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [farmId, session?.access_token, isPreview]);

  if (!isPreview && !farmId) return null;

  const farmName = isPreview ? previewProfile?.farm?.name ?? "Green Valley Farm" : profile?.farm?.name;
  const report = isPreview ? devFarmReport : statistics;

  function generateReport() {
    setReportDate(new Date().toISOString());
  }

  if (loading) return <LoadingState message="Loading farm report..." />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!report) return <EmptyState title="No report data yet" message="Farm statistics will appear here after diagnoses are recorded." />;

  const totalDiagnoses = isPreview ? report.totalDiagnoses : report.total_diagnoses;
  const healthyDiagnoses = isPreview ? report.healthyDiagnoses : report.healthy_diagnoses;
  const diseasedDiagnoses = isPreview ? report.sickDiagnoses : report.diseased_diagnoses;
  const identifiedDiseases = isPreview
    ? report.identifiedDiseases
    : Object.keys(report.disease_counts ?? {}).filter((disease) => !getClassInfo(disease).healthy).length;
  const cropsScanned = isPreview
    ? report.cropsScanned
    : Object.entries(report.crop_counts ?? {}).map(([crop, count]) => ({ crop, count }));
  const topDiseases = isPreview ? report.topDiseases : report.top_diseases;
  const recentDiagnoses = isPreview ? report.recentDiagnoses : report.recent_diagnoses;

  return (
    <div aria-label="Farm report">
      <PageHeader
        title="Farm Report"
        subtitle="Overview of crop health and farm activity for printing or sharing."
        actions={
          <div className="report-toolbar">
            <Button variant="accent" onClick={generateReport}>
              <Icon name="leaf" />
              Generate Farm Report
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Icon name="print" />
              Print
            </Button>
          </div>
        }
      />

      <div className="report">
        <h1>{farmName}</h1>
        <div className="report-meta">
          Farm health report • Generated on {formatDate(reportDate)}
        </div>

        <section className="report-section" aria-label="At a glance">
          <h2>At a glance</h2>
          <div className="report-stats">
            <div className="report-stat">
              <span className="report-stat-label">Farmers</span>
              <span className="report-stat-value">{report.totalFarmers}</span>
            </div>
            <div className="report-stat">
              <span className="report-stat-label">Diagnoses</span>
              <span className="report-stat-value">{totalDiagnoses}</span>
            </div>
            <div className="report-stat">
              <span className="report-stat-label">Healthy</span>
              <span className="report-stat-value report-stat-healthy">{healthyDiagnoses}</span>
            </div>
            <div className="report-stat">
              <span className="report-stat-label">Sick</span>
              <span className="report-stat-value report-stat-sick">{diseasedDiagnoses}</span>
            </div>
            <div className="report-stat">
              <span className="report-stat-label">Diseases</span>
              <span className="report-stat-value">{report.identifiedDiseases}</span>
            </div>
          </div>
        </section>

        <section className="report-section" aria-label="Crops scanned">
          <h2>Crops scanned</h2>
          <ul className="report-list">
            {cropsScanned.map((item) => (
              <li key={item.crop}>
                {item.crop} — {item.count} scans
              </li>
            ))}
          </ul>
        </section>

        <section className="report-section" aria-label="Identified diseases">
          <h2>Identified diseases</h2>
          <ul className="report-list">
            {topDiseases.map((item) => (
              <li key={item.disease}>
                {item.disease} — {item.count} cases
              </li>
            ))}
          </ul>
        </section>

        <section className="report-section" aria-label="Recent diagnoses">
          <h2>Recent diagnoses</h2>
          <div className="diag-table-wrap">
            <table className="diag-table report-table">
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
                {recentDiagnoses.map((entry) => {
                  const info = getClassInfo(entry.disease ?? entry.className);
                  const farmerName = entry.farmer_name ?? entry.farmer;
                  const confidence = entry.confidence <= 1 ? Math.round(entry.confidence * 100) : entry.confidence;
                  return (
                    <tr key={entry.id}>
                      <td>{farmerName}</td>
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
        </section>

        <section className="report-section" aria-label="Health summary">
          <h2>Health summary</h2>
          <p>
            {healthyDiagnoses} of {totalDiagnoses} diagnoses were healthy.{" "}
            {diseasedDiagnoses} plants needed attention. Keep monitoring your crops and
            record any new signs early.
          </p>
        </section>
      </div>
    </div>
  );
}

export default FarmReportPage;