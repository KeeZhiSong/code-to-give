import Link from "next/link";

/** Shared masthead. Links back to the events index from anywhere. */
export default function AppHeader({ title, subtitle, children }) {
  return (
    <header className="top">
      <Link href="/" aria-label="All events">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo.png" alt="Passion To Serve" />
      </Link>
      <div style={{ flex: 1 }}>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}
