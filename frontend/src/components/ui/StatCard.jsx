import React from "react";

const StatCard = React.memo(function StatCard({ label, value, trend, trendTone = "muted" }) {
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {trend && <p className={`stat-trend stat-trend-${trendTone}`}>{trend}</p>}
    </div>
  );
});

export default StatCard;