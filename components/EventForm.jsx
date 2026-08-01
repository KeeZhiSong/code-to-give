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
          <span className="muted">Ends</span>
          <input
            type="datetime-local"
            value={form.ends_at}
            onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
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

      <div className="fields" style={{ marginTop: 12 }}>
        <label>
          <span className="muted">Meeting point</span>
          <input
            type="text"
            value={form.meeting_point}
            onChange={(e) => setForm({ ...form, meeting_point: e.target.value })}
            placeholder="by the main gate"
          />
        </label>

        <label>
          <span className="muted">Dress code</span>
          <input
            type="text"
            value={form.dress_code}
            onChange={(e) => setForm({ ...form, dress_code: e.target.value })}
            placeholder="Comfortable clothes, covered shoes"
          />
        </label>

        <label>
          <span className="muted">What to bring</span>
          <input
            type="text"
            value={form.what_to_bring}
            onChange={(e) => setForm({ ...form, what_to_bring: e.target.value })}
            placeholder="A water bottle and a cap"
          />
        </label>

        {/* Who to look for on arrival, and who to call if they're lost. */}
        <label>
          <span className="muted">On-the-day contact</span>
          <input
            type="text"
            value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            placeholder="Priya (Volunteer Lead)"
          />
        </label>

        <label>
          <span className="muted">Contact number</span>
          <input
            type="text"
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            placeholder="+65 9123 4567"
          />
        </label>
      </div>

      <label style={{ display: "block", marginTop: 12 }}>
        <span className="muted">
          What this event is — one or two sentences, sent with the invite
        </span>
        <textarea
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Sorting and distributing donated items to migrant workers."
        />
      </label>

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

      {/* The automatic reply after someone votes. Left blank, the default
          wording in lib/eventMessage.js is used — which already names the
          event and repeats the time, venue and what to bring. */}
      <div className="fields" style={{ marginTop: 12 }}>
        <label>
          <span className="muted">Reply when they say yes</span>
          <input
            type="text"
            value={form.confirm_yes}
            onChange={(e) => setForm({ ...form, confirm_yes: e.target.value })}
            placeholder="You're on the list for …  (leave blank for the default)"
          />
        </label>

        <label>
          <span className="muted">Reply when they can&apos;t make it</span>
          <input
            type="text"
            value={form.confirm_no}
            onChange={(e) => setForm({ ...form, confirm_no: e.target.value })}
            placeholder="No worries … (leave blank for the default)"
          />
        </label>
      </div>

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
