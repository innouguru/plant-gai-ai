import Icon from "./Icon";

function StateScreen({ icon = "leaf", title, children, action, role = "status", live = "polite" }) {
  return (
    <div className="state-screen" role={role} aria-label={title} aria-live={live} aria-atomic="true">
      <Icon name={icon} size={40} />
      <h3 className="state-title">{title}</h3>
      {children && <div>{children}</div>}
      {action}
    </div>
  );
}

export function LoadingState({ message = "Loading..." }) {
  return (
    <StateScreen title={message}>
      <span className="spinner spinner-sm" aria-hidden="true" />
    </StateScreen>
  );
}

export function EmptyState({ title = "Nothing here yet", message, children }) {
  return (
    <StateScreen icon="leaf" title={title}>
      {message && <p>{message}</p>}
      {children}
    </StateScreen>
  );
}

export function ErrorState({ message, onRetry, children }) {
  return (
    <StateScreen icon="alert" title="Something went wrong" role="alert" live="assertive">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
      {children}
    </StateScreen>
  );
}

export default StateScreen;