const VARIANTS = {
  healthy: "badge-healthy",
  sick: "badge-sick",
  alert: "badge-alert",
};

function StatusBadge({ status, className = "", children }) {
  const variant = VARIANTS[status] ?? "badge-alert";
  const label = String(status ?? "").toUpperCase();
  return (
    <span className={["badge", variant, className].filter(Boolean).join(" ")}>
      {children ?? label}
    </span>
  );
}

export default StatusBadge;