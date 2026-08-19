function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="admin-page-header">
      <div className="admin-page-header-row">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="admin-page-actions">{actions}</div>}
      </div>
    </header>
  );
}

export default PageHeader;