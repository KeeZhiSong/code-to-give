"use client";

// Create or edit an event. The poll question is the field that matters most:
// it's what volunteers actually see on WhatsApp.

import { PILLARS } from "@/lib/ui/format";

export default function EventForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  saving,
  editing,
}) {
  return (
    <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
      <div className="fields">
        <label>
          <span className="muted">Event name *</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="GIFTIK Sunday drive"
            required
          />
        </label>

        <label>
          <span className="muted">Pillar</span>
          <select
            value={form.pillar}
            onChange={(e) => setForm({ ...form, pillar: e.target.value })}
          >
            <option value="">—</option>
            {PILLARS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="muted">Track</span>
          <input
            type="text"
            value={form.track}
            onChange={(e) => setForm({ ...form, track: e.target.value })}
            placeholder="AI &amp; Coding"
          />
        </label>

        <label>
          <span className="muted">Starts</span>
          <input
            type="datetime-local"
            value={form.starts_at}
            onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
          />
        </label>

        <label>
          <span className="muted">Venue</span>
          <input
            type="text"
            value={form.venue}
            onChange={(e) => setForm({ ...form, venue: e.target.value })}
            placeholder="Kranji Recreation Centre"
          />
        </label>

        <label>
          <span className="muted">Capacity</span>
          <input
            type="number"
            min="0"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            placeholder="25"
          />
        </label>

        <label>
          <span className="muted">Points per attendance</span>
          <input
            type="number"
            min="1"
            value={form.points_value}
            onChange={(e) => setForm({ ...form, points_value: e.target.value })}
            placeholder="1"
          />
        </label>
      </div>

      <label style={{ display: "block", marginTop: 12 }}>
        <span className="muted">
          Poll question * — this is what volunteers see on WhatsApp
        </span>
        <input
          type="text"
          value={form.question}
          onChange={(e) => setForm({ ...form, question: e.target.value })}
          placeholder="Join Sunday's GIFTIK distribution drive? 🙌"
          required
        />
      </label>

      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Create event"}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
