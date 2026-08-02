"use client";

// Events index — the home screen, and the one screen allowed a real front
// door (DESIGN.md: "Two registers, one system"). Everything past this page
// lives in the quieter Operate register at /events/[id].
//
// "Which events are we running, and are they ready?" is the first question an
// organiser has, and it's the one the old single-page console buried under a
// dropdown.

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EventForm from "@/components/EventForm.jsx";
import EventReadinessBadge from "@/components/EventReadinessBadge.jsx";
import { useEvents } from "@/lib/ui/useEvents";
import { BLANK_EVENT, formatWhen } from "@/lib/ui/format";

// A quiet organic glow, not a stock hero image — three soft blurred fields in
// the brand's own navy/teal/gold, cheap to render, nothing to source or
// license. Purely atmospheric: it never carries information, unlike the
// readiness rings beside it.
function HeroScene() {
  return (
    <svg className="hero-scene" viewBox="0 0 800 320" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <defs>
        <filter id="heroBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="46" />
        </filter>
      </defs>
      <g filter="url(#heroBlur)">
        <circle cx="640" cy="80" r="130" fill="#1C6B5E" opacity="0.55" />
        <circle cx="740" cy="230" r="100" fill="#C9A24B" opacity="0.28" />
        <circle cx="560" cy="260" r="90" fill="#3A5570" opacity="0.35" />
      </g>
    </svg>
  );
}

export default function EventsIndex() {
  const router = useRouter();
  const { events, loading, error, save } = useEvents();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_EVENT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Fed by each card's own readiness fetch — real data driving the stat
  // strip, not a separate aggregate query.
  const [scores, setScores] = useState({});
  const recordScore = useCallback((eventId, data) => {
    setScores((prev) => ({ ...prev, [eventId]: data }));
  }, []);
  const needsAttention = useMemo(
    () => Object.values(scores).filter((s) => s.label !== "on-track").length,
    [scores]
  );

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
      <div className="hero">
        <HeroScene />
        <div className="hero-content">
          <div>
            <h1>Run every event with confidence.</h1>
            <p>One place to plan, staff, and know an event is actually ready — not five spreadsheets and a dozen chats.</p>
          </div>
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
      </div>

      {events.length > 0 && (
        <div className="stat-strip">
          <div className="stat">
            <span className="n">{events.length}</span>
            <span className="l">{events.length === 1 ? "event" : "events"}</span>
          </div>
          {needsAttention > 0 && (
            <div className="stat">
              <span className="n" style={{ color: "var(--no)" }}>{needsAttention}</span>
              <span className="l">need attention</span>
            </div>
          )}
        </div>
      )}

      {loading && <p className="muted">Loading events…</p>}
      {error && <div className="err">{error}</div>}

      {!loading && events.length === 0 && !showForm && (
        <p className="muted">
          No events yet. Create one to start inviting volunteers.
        </p>
      )}

      {showForm && (
        <section className="card">
          <h2 style={{ margin: "0 0 14px" }}>New event</h2>
          <EventForm
            form={form}
            setForm={setForm}
            onSubmit={onSubmit}
            onCancel={() => setShowForm(false)}
            saving={saving}
          />
          {formError && <div className="err">{formError}</div>}
        </section>
      )}

      {events.length > 0 && (
        <ul className="event-grid">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className="event-card">
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
                {!e.readOnly && <EventReadinessBadge eventId={e.id} onScore={recordScore} />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
