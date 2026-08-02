"use client";

// Events index — the home screen.
//
// "Which events are we running, and are they ready?" is the first question an
// organiser has, and it's the one the old single-page console buried under a
// dropdown. Everything else lives inside an event, at /events/[id].

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader.jsx";
import EventForm from "@/components/EventForm.jsx";
import EventReadinessBadge from "@/components/EventReadinessBadge.jsx";
import { useEvents } from "@/lib/ui/useEvents";
import { BLANK_EVENT, formatWhen } from "@/lib/ui/format";

export default function EventsIndex() {
  const router = useRouter();
  const { events, loading, error, save } = useEvents();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_EVENT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const created = await save(form);
      setShowForm(false);
      setForm(BLANK_EVENT);
      router.push(`/events/${created.id}`);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wrap">
      <AppHeader
        title="Events"
        subtitle="Coordinate volunteer-led events, end to end."
      />

      <section className="card">
        <div className="between" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Events</h2>
          {!showForm && (
            <button
              className="primary"
              onClick={() => {
                setForm(BLANK_EVENT);
                setFormError("");
                setShowForm(true);
              }}
            >
              + New event
            </button>
          )}
        </div>

        {loading && <p className="muted">Loading events…</p>}
        {error && <div className="err">{error}</div>}

        {!loading && events.length === 0 && !showForm && (
          <p className="muted">
            No events yet. Create one to start inviting volunteers.
          </p>
        )}

        {showForm && (
          <>
            <EventForm
              form={form}
              setForm={setForm}
              onSubmit={onSubmit}
              onCancel={() => setShowForm(false)}
              saving={saving}
            />
            {formError && <div className="err">{formError}</div>}
          </>
        )}

        {events.length > 0 && (
          <ul className="eventlist">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="eventrow">
                  <span className="ev-main">
                    <strong>{e.name}</strong>
                    <span className="muted">
                      {[
                        formatWhen(e.starts_at),
                        e.venue,
                        e.pillar,
                        e.capacity ? `capacity ${e.capacity}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {/* Readiness is the reason to open one event over another. */}
                  {!e.readOnly && <EventReadinessBadge eventId={e.id} />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
