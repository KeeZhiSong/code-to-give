"use client";

// Persistent navigation. Every screen in the app is reachable from here, which
// matters because Templates and Operations were built as standalone pages with
// no way back to anything.
//
// Deliberately absent on /share: that link goes to a logistics partner who has
// no account and no business seeing the console's navigation.

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Events", hint: "Plan and run", exact: true },
  { href: "/beneficiaries", label: "Beneficiaries", hint: "Who we serve" },
  { href: "/dispatch", label: "Templates", hint: "Reuse a past event" },
  { href: "/operations", label: "Operations", hint: "On-the-day logistics" },
  { href: "/volunteer_shift", label: "Shifts", hint: "Coverage and standbys" },
];

export default function Sidebar() {
  const pathname = usePathname();

  // The public headcount page stands alone, and so does the landing page —
  // someone arriving cold is deciding whether to look, not navigating a
  // console they already use.
  if (pathname.startsWith("/share") || pathname.startsWith("/welcome")) {
    return null;
  }

  return (
    <nav className="sidebar" aria-label="Main">
      <Link href="/" className="sb-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={30} height={30} />
        <span>Passion To Serve</span>
      </Link>

      <ul className="sb-nav">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === "/" || pathname.startsWith("/events")
            : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link href={item.href} className={active ? "on" : ""}>
                <span className="sb-label">{item.label}</span>
                <span className="sb-hint">{item.hint}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
