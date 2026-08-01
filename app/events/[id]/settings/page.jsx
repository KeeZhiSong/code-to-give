"use client";

// Settings — edit or delete this event.
//
// Delete is destructive and cascades to the roster, so it says so before
// asking, not after.

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EventForm from "@/components/EventForm.jsx";
import { useEvent, useEvents } from "@/lib/ui/useEvents";
import { BLANK_EVENT, toLocalInput } from "@/lib/ui/format";

export default function SettingsPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const { event, reload } = useEvent(id);
  const { save, remove } = useEvents();

  const [form, setForm] = useState(BLANK_EVENT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!event) return;
    setForm({
      ...BLANK_EVENT,
      ...event,
      starts_at: toLocalInput(event.starts_at),
      capacity: event.capacity ?? "",
      points_value: event.points_value ?? "",
      pillar: event.pillar ?? "",
      track: event.track ?? "",
      venue: event.venue ?? "",
    });
  }, [event]);

  if (event?.readOnly) {
    return (
      <section className="card">
        <h2>Settings</h2>
        <p className="muted">
          This is the read-only fallback event from <code>lib/config.js</code>.
          Set <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code>{" "}
          to manage real events.
        </p>
      </section>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await save(form, id);
      await reload();
      setSaved(true);
      router.refresh(); // the layout renders the name and venue
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (
      !confirm(
        `Delete "${event?.name}"? Its roster, tasks and logistics partners are deleted too. This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await remove(id);
      router.push("/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="card">
      <div className="between" style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Settings</h2>
        <button onClick={onDelete}>Delete event</button>
      </div>

      <EventForm
        form={form}
        setForm={setForm}
        onSubmit={onSubmit}
        onCancel={() => router.push(`/events/${id}`)}
        saving={saving}
        editing
      />

      {saved && <div className="ok">Saved.</div>}
      {error && <div className="err">{error}</div>}
    </section>
  );
}
