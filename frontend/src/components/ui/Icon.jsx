const ICON_PATHS = {
  leaf: (
    <>
      <path d="M5 20C5 10 11 4 21 4c0 10-6 16-16 16z" />
      <path d="M5 20c4-5 8-9 12-13" />
    </>
  ),
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7l1.5-2h5L16 7" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  history: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M21 3v4h-4" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  dashboard: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 20c.7-3.2 2.9-5 5.5-5s4.8 1.8 5.5 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16.5 15.5c1.6.3 3 1.4 3.7 3.6" />
    </>
  ),
  diagnostics: <path d="M3 12h4l2-5 4 10 2-5h6" />,
  messages: (
    <>
      <path d="M4 5h16v11H10l-4 4v-4H4z" />
      <path d="M8 10h8M8 13h5" />
    </>
  ),
  tip: (
    <>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1 1.5 2.1h4c0-1.1.7-1.5 1.5-2.1A6 6 0 0 0 12 3z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  send: (
    <>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7z" />
    </>
  ),
  print: (
    <>
      <path d="M6 8V4h12v4" />
      <rect x="3" y="8" width="18" height="7" rx="1.5" />
      <path d="M7 15h10v6H7z" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.5 20h19L12 3z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  arrow: <path d="M4 12h16M13 5l7 7-7 7" />,
};

function Icon({
  name,
  size = 24,
  className = "",
  "aria-hidden": ariaHidden = true,
  label,
}) {
  const titleId = label ? `icon-${name}-${Math.random().toString(36).slice(2, 7)}` : undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : ariaHidden}
      aria-labelledby={label ? titleId : undefined}
      role={label ? "img" : undefined}
    >
      {label ? <title id={titleId}>{label}</title> : null}
      {ICON_PATHS[name] ?? null}
    </svg>
  );
}

export default Icon;