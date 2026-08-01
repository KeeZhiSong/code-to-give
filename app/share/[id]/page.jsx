import { notFound } from "next/navigation";
import { getEvent } from "../../../lib/events.js";
import { getEventHeadcount } from "../../../lib/headcount.js";
import ShareHeadcount from "../../../components/ShareHeadcount.jsx";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const event = await getEvent(id).catch(() => null);
  return { title: event ? `${event.name} — Headcount` : "Headcount" };
}

// Public, read-only. No login, no organiser controls — this is the link an
// organiser hands to a transport or warehouse partner so they can plan
// around headcount without needing platform access.
export default async function SharePage({ params }) {
  const { id } = await params;
  const event = await getEvent(id).catch(() => null);
  if (!event || event.readOnly) notFound();

  const headcount = await getEventHeadcount(id).catch(() => null);
  if (!headcount) notFound();

  return (
    <div className="pf-share-page">
      <div className="pf-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pf-brand-mark" src="/logo.png" alt="Passion To Serve" />
        <div>
          <h1>{event.name}</h1>
          <div className="pf-sub">
            {event.venue ? `${event.venue} · ` : ""}
            {event.starts_at
              ? new Date(event.starts_at).toLocaleString([], {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Date to be confirmed"}
          </div>
        </div>
      </div>

      <ShareHeadcount eventId={id} initialData={headcount} />

      <p className="pf-share-help" style={{ marginTop: 20 }}>
        Live headcount from Passion To Serve's event console — updates automatically, no need to refresh.
      </p>
    </div>
  );
}
