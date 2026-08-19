import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import StatusBadge from "../../components/ui/StatusBadge";
import { getClassInfo } from "../../data/crops";
import { formatDate, formatDateTime } from "../../data/dates";
import { devFarmReport } from "../../data/devMocks";

function FarmReportPage() {
  const { profile } = useAuth();
  const farmName = profile?.farm?.name ?? "Green Valley Farm";
  const report = devFarmReport;
  const [reportDate, setReportDate] = useState(report.reportDate);

  function generateReport() {
    setReportDate(new Date().toISOString());
  }

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
              <span className="report-stat-value">{report.totalDiagnoses}</span>
            </div>
            <div className="report-stat">
              <span className="report-stat-label">Healthy</span>
              <span className="report-stat-value report-stat-healthy">{report.healthyDiagnoses}</span>
            </div>
            <div className="report-stat">
              <span className="report-stat-label">Sick</span>
              <span className="report-stat-value report-stat-sick">{report.sickDiagnoses}</span>
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
            {report.cropsScanned.map((item) => (
              <li key={item.crop}>
                {item.crop} — {item.count} scans
              </li>
            ))}
          </ul>
        </section>

        <section className="report-section" aria-label="Identified diseases">
          <h2>Identified diseases</h2>
          <ul className="report-list">
            {report.topDiseases.map((item) => (
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
                {report.recentDiagnoses.map((entry) => {
                  const info = getClassInfo(entry.className);
                  return (
                    <tr key={entry.id}>
                      <td>{entry.farmer}</td>
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
        </section>

        <section className="report-section" aria-label="Health summary">
          <h2>Health summary</h2>
          <p>
            {report.healthyDiagnoses} of {report.totalDiagnoses} diagnoses were healthy.{" "}
            {report.sickDiagnoses} plants needed attention. Keep monitoring your crops and
            record any new signs early.
          </p>
        </section>
      </div>
    </div>
  );
}

export default FarmReportPage;