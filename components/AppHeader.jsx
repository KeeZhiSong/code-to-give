/**
 * Page masthead. Branding lives in the sidebar, so this is just the title,
 * a subtitle, and room for page-level actions on the right.
 */
export default function AppHeader({ title, subtitle, children }) {
  return (
    <header className="top">
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}
