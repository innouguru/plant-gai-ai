import Icon from "./Icon";

function Logo({ inverse = false, compact = false }) {
  return (
    <span className={["logo", inverse ? "logo-inverse" : "", compact ? "logo-compact" : ""].filter(Boolean).join(" ")}>
      <span className="logo-mark">
        <Icon name="leaf" size={compact ? 20 : 22} />
      </span>
      <span className="logo-text">
        Plant-GAI
        <span className="logo-sub">-AI</span>
      </span>
    </span>
  );
}

export default Logo;