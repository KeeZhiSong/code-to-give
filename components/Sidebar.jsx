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

  // The public headcount page stands alone.
  if (pathname.startsWith("/share")) return null;

  return (
    <nav className="sidebar" aria-label="Main">
      <Link href="/" className="sb-brand">
        {/* The source PNG has an opaque white background baked in, not
            transparency — clipping it to a circle cut into the artwork and
            left a mismatched edge on the navy sidebar. A real white badge
            behind it reads as intentional instead of a rendering glitch,
            and gives the fine cursive linework room to actually resolve. */}
        <span className="sb-logo-badge">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={34} height={34} />
        </span>
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
