// Shell for one event: masthead, the event's details, and the tab nav.
// Every page under /events/[id] renders inside this, so the event context is
// established once rather than re-fetched per tab.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getEvent } from "@/lib/events.js";
import AppHeader from "@/components/AppHeader.jsx";
import EventTabs from "@/components/EventTabs.jsx";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const event = await getEvent(id).catch(() => null);
  return { title: event ? `${event.name} — Passion To Serve` : "Event" };
}

function formatWhen(value) {
  if (!value) return "no date set";
  return new Date(value).toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EventLayout({ children, params }) {
  const { id } = await params;
  const event = await getEvent(id).catch(() => null);
  if (!event) notFound();

  const details = [
    formatWhen(event.starts_at),
    event.venue,
    event.pillar,
    event.capacity ? `capacity ${event.capacity}` : null,
  ].filter(Boolean);

  return (
    <div className="wrap">
      <AppHeader title={event.name} subtitle={details.join(" · ")}>
        <Link href={`/share/${id}`} className="btnlink" target="_blank">
          Share headcount
        </Link>
      </AppHeader>

      <EventTabs eventId={id} />

      {children}
    </div>
  );
}
