"use client";

// Beneficiaries — the migrant workers Passion To Serve exists to support.
//
// A top-level page rather than an event tab: unlike a roster, a beneficiary
// isn't scoped to one event. They accumulate courses and attendances across
// everything the organisation runs, and the VIP Pass is earned on that total.
//
// Still organiser-facing. Beneficiaries reach us over WhatsApp; this is the
// desk-side view for the person registering them.

import { useCallback, useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader.jsx";
import { maskPhone } from "@/lib/ui/format";

const BLANK = {
  name: "",
  phone: "",
  languages: "",
  courses: "",
  area: "",
  notes: "",
};

// The languages PTS actually works in — offered as quick-adds so a desk entry
// doesn't depend on spelling.
const COMMON_LANGUAGES = ["Tamil", "Bengali", "Mandarin", "Malay", "English", "Burmese", "Hindi"];
const COMMON_COURSES = [
  "Spoken English",
  "Digital Literacy",
  "Financial Literacy",
  "MS Excel",
  "AI & Coding",
];

export default function BeneficiariesPage() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [search, setSearch] = useState("");

  // Attendance logging. Which row's picker is open, what it has selected, and
  // which phone is mid-write — so only that row's buttons disable.
  const [events, setEvents] = useState([]);
  const [pickerFor, setPickerFor] = useState(null);
  const [pick, setPick] = useState("");
  const [busyPhone, setBusyPhone] = useState("");
  // Who just crossed the VIP threshold on THIS click. Only set from the
  // server's justBecameVip, so it fires on the attendance that actually
  // unlocked the pass — never on a reload of someone who was already VIP.
  const [justVip, setJustVip] = useState(null);

  const load = useCallback(
    () =>
      fetch("/api/beneficiaries")
        .then((r) => r.json())
        .then((d) => {
          if (d.error) return setError(d.error);
          setError("");
          setPeople(d.beneficiaries || []);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  // Events are only needed for the attendance picker, so a failure here is
  // never worth blocking the page over — the picker just says there are none.
  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
      .catch(() => {});
  }, []);

  /**
   * Log or undo an attendance.
   *
   * Beneficiaries mostly don't RSVP — they turn up to a GIFTIK queue or walk
   * into a class. The roster's "mark attended" needs a poll answer first, so
   * without this the VIP Pass is unreachable for the people it's actually for.
   *
   * Same endpoint the roster uses: one attendance writer, so points, VIP and
   * events_attended can't drift apart.
   */
  async function logAttendance(person, eventName, undo = false) {
    setBusyPhone(person.phone);
    setError("");
    try {
      const res = await fetch(
        `/api/volunteers/${encodeURIComponent(person.phone)}/attended`,
        {
          method: undo ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventName }),
        }
      );
      const data = await res.json();
      if (data.error) return setError(data.error);
      setPickerFor(null);
      setPick("");
      await load();
      if (!undo && data.loyalty?.justBecameVip) {
        setJustVip(person.id);
        // Long enough to be seen, short enough that it isn't still playing
        // when the organiser moves to the next person in the queue.
        setTimeout(() => setJustVip(null), 2000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyPhone("");
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch(
        editingId ? `/api/beneficiaries/${editingId}` : "/api/beneficiaries",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (data.error) return setFormError(data.error);
      await load();
      setShowForm(false);
      setEditingId(null);
      setForm(BLANK);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(person) {
    if (
      !confirm(
        `Remove ${person.name}? Their attendance history and VIP status go with them. This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/beneficiaries/${person.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) return setError(data.error);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      phone: p.phone,
      languages: (p.languages || []).join(", "),
      courses: (p.courses || []).join(", "),
      area: p.area || "",
      notes: p.notes || "",
    });
    setFormError("");
    setShowForm(true);
  }

  // Adds a suggestion to a comma-separated field without duplicating it.
  function addChip(field, value) {
    setForm((f) => {
      const current = f[field]
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (current.includes(value)) return f;
      return { ...f, [field]: [...current, value].join(", ") };
    });
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.area || "").toLowerCase().includes(q) ||
        (p.languages || []).some((l) => l.toLowerCase().includes(q)) ||
        (p.courses || []).some((c) => c.toLowerCase().includes(q))
    );
  }, [people, search]);

  const vipCount = people.filter((p) => p.vipStatus).length;
  const attendedCount = people.filter(
    (p) => (p.eventsAttended || []).length > 0
  ).length;

  return (
    <div className="wrap">
      <AppHeader
        title="Beneficiaries"
        subtitle="Migrant workers we support — courses, attendance and VIP status."
      >
        {!showForm && (
          <button
            className="primary"
            onClick={() => {
              setEditingId(null);
              setForm(BLANK);
              setFormError("");
              setShowForm(true);
            }}
          >
            + Add beneficiary
          </button>
        )}
      </AppHeader>

      {people.length > 0 && (
        <section className="card">
          <div className="counts">
            <div className="count">
              <div className="n">{people.length}</div>
              <div className="l">Registered</div>
            </div>
            <div className="count yes">
              <div className="n">{vipCount}</div>
              <div className="l">VIP Pass</div>
            </div>
            <div className="count">
              <div className="n">{attendedCount}</div>
              <div className="l">Have attended</div>
            </div>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            A VIP Pass unlocks after 4 logged attendances and gives priority
            access at GIFTIK distribution events.
          </p>
        </section>
      )}

      {showForm && (
        <section className="card enter">
          <h2>{editingId ? "Edit beneficiary" : "Add beneficiary"}</h2>
          <form onSubmit={save}>
            <div className="fields">
              <label>
                <span className="muted">Name *</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Rahim Uddin"
                  required
                />
              </label>

              <label>
                <span className="muted">WhatsApp number *</span>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="9123 4567"
                  required
                />
              </label>

              <label>
                <span className="muted">Area / dormitory</span>
                <input
                  type="text"
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                  placeholder="Kranji"
                />
              </label>
            </div>

            <label style={{ display: "block", marginTop: 12 }}>
              <span className="muted">
                Languages — so we can write to them in one they read
              </span>
              <input
                type="text"
                value={form.languages}
                onChange={(e) => setForm({ ...form, languages: e.target.value })}
                placeholder="Tamil, English"
              />
            </label>
            <div className="row" style={{ flexWrap: "wrap", marginTop: 6 }}>
              {COMMON_LANGUAGES.map((l) => (
                <button
                  key={l}
                  type="button"
                  className="tiny"
                  onClick={() => addChip("languages", l)}
                >
                  + {l}
                </button>
              ))}
            </div>

            <label style={{ display: "block", marginTop: 12 }}>
              <span className="muted">Courses they&apos;re taking or interested in</span>
              <input
                type="text"
                value={form.courses}
                onChange={(e) => setForm({ ...form, courses: e.target.value })}
                placeholder="Spoken English, Digital Literacy"
              />
            </label>
            <div className="row" style={{ flexWrap: "wrap", marginTop: 6 }}>
              {COMMON_COURSES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="tiny"
                  onClick={() => addChip("courses", c)}
                >
                  + {c}
                </button>
              ))}
            </div>

            <label style={{ display: "block", marginTop: 12 }}>
              <span className="muted">Notes — never overwritten by a form sync</span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Prefers morning sessions. Works night shift."
              />
            </label>

            <div className="row" style={{ marginTop: 12 }}>
              <button className="primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Add beneficiary"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormError("");
                }}
              >
                Cancel
              </button>
            </div>

            {formError && <div className="err">{formError}</div>}
          </form>
        </section>
      )}

      <section className="card">
        <div className="between" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Registered</h2>
          {people.length > 0 && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, area, language, course"
              style={{ maxWidth: 280 }}
            />
          )}
        </div>

        {loading && <p className="muted">Loading…</p>}
        {error && <div className="err">{error}</div>}

        {!loading && people.length === 0 && !error && (
          <p className="muted">
            No beneficiaries yet. Add one above — most are registered in person,
            at a distribution queue or a course sign-in.
          </p>
        )}

        {people.length > 0 && visible.length === 0 && (
          <p className="muted">Nobody matches that search.</p>
        )}

        {visible.map((p) => {
          const attended = p.eventsAttended || [];
          // How many more visits until the pass unlocks (threshold is 3, so
          // the 4th attendance grants it).
          const toGo = Math.max(0, 4 - attended.length);
          // Logging the same event twice is a no-op, so don't offer it.
          const unlogged = events.filter((ev) => !attended.includes(ev.name));
          return (
            <div key={p.id} className="benef">
              <div className="between">
                <span className="nm">
                  <strong>{p.name || "—"}</strong>
                  {p.vipStatus && (
                    <span
                      className={`tag pts${justVip === p.id ? " vip-new" : ""}`}
                    >
                      ⭐ VIP Pass
                    </span>
                  )}
                  <span className="sub">
                    {[
                      maskPhone(p.phone),
                      p.area,
                      (p.languages || []).join(", "),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="row">
                  <button
                    className="tiny"
                    onClick={() => {
                      setPickerFor(pickerFor === p.id ? null : p.id);
                      setPick("");
                    }}
                  >
                    Log attendance
                  </button>
                  <button className="tiny" onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  <button className="tiny" onClick={() => remove(p)}>
                    Remove
                  </button>
                </span>
              </div>

              {pickerFor === p.id && (
                <div className="row picker" style={{ marginTop: 8, flexWrap: "wrap" }}>
                  <select
                    value={pick}
                    onChange={(e) => setPick(e.target.value)}
                    aria-label={`Event attended by ${p.name}`}
                  >
                    <option value="">Which event?</option>
                    {unlogged.map((ev) => (
                      <option key={ev.id || ev.name} value={ev.name}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="primary tiny"
                    disabled={!pick || busyPhone === p.phone}
                    onClick={() => logAttendance(p, pick)}
                  >
                    {busyPhone === p.phone ? "Logging…" : "Log"}
                  </button>
                  <button className="tiny" onClick={() => setPickerFor(null)}>
                    Cancel
                  </button>
                  {unlogged.length === 0 && (
                    <span className="muted">
                      {events.length === 0
                        ? "No events yet."
                        : "Already logged for every event."}
                    </span>
                  )}
                </div>
              )}

              {(p.courses || []).length > 0 && (
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  Courses: {p.courses.join(" · ")}
                </p>
              )}

              {attended.length === 0 ? (
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  No attendances logged yet
                </p>
              ) : (
                <div className="row" style={{ flexWrap: "wrap", marginTop: 4 }}>
                  <span className="muted">{attended.length} attended:</span>
                  {attended.map((name) => (
                    <span key={name} className="tag" title={name}>
                      {name}
                      {/* Logging grants points and can flip a VIP Pass, so a
                          mis-tap at a busy queue needs a way back. */}
                      <button
                        type="button"
                        className="x"
                        aria-label={`Undo ${name}`}
                        disabled={busyPhone === p.phone}
                        onClick={() => logAttendance(p, name, true)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {!p.vipStatus && (
                    <span className="muted">— {toGo} more for VIP</span>
                  )}
                </div>
              )}

              {p.notes && (
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  📝 {p.notes}
                </p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
