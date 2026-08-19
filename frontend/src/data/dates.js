export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(value) {
  if (!value) return "";
  return `${formatDate(value)} at ${formatTime(value)}`;
}

export function formatRelativeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startOfToday - startOfDay) / 86400000);

  if (days <= 0) return "Scanned today";
  if (days === 1) return "Scanned yesterday";
  if (days < 7) return `Scanned ${days} days ago`;
  return `Scanned ${formatDate(value)}`;
}