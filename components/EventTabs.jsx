"use client";

// Tab navigation for one event. Real routes rather than client state, so each
// tab is bookmarkable, the browser back button works, and each loads only its
// own JavaScript.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Send, ListChecks, Settings } from "lucide-react";

const TABS = [
  { slug: "", label: "Overview", Icon: LayoutDashboard },
  { slug: "people", label: "People", Icon: Users },
  { slug: "broadcast", label: "Broadcast", Icon: Send },
  { slug: "tasks", label: "Tasks", Icon: ListChecks },
  { slug: "settings", label: "Settings", Icon: Settings },
];

export default function EventTabs({ eventId }) {
  const pathname = usePathname();
  const base = `/events/${eventId}`;

  return (
    <nav className="tabs" aria-label="Event sections">
      {TABS.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        // Overview is the index route, so it must match exactly — otherwise
        // every child path would light it up too.
        const active = tab.slug ? pathname.startsWith(href) : pathname === base;
        return (
          <Link key={tab.slug} href={href} className={active ? "on" : ""}>
            <tab.Icon size={15} aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
