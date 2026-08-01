"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import ReadinessScore from "../components/ReadinessScore.jsx";
import HeadcountDashboard from "../components/HeadcountDashboard.jsx";
import LogisticsPartners from "../components/LogisticsPartners.jsx";
import TaskBoard from "../components/TaskBoard.jsx";

// Volunteers who signed up before a form question existed have a blank value
// for it. They must stay visible under "All" — never silently dropped.
const ANY = "__any__";

const BLANK_EVENT = {
  name: "",
  pillar: "",
  track: "",
  starts_at: "",
  venue: "",
  capacity: "",
  question: "",
  status: "open",
};

const PILLARS = ["Items To Serve", "Knowledge To Serve", "Peace To Serve"];

// "2026-08-09T09:00:00+00:00" -> "2026-08-09T09:00" for <input datetime-local>.
function toLocalInput(value) {
  return value ? String(value).slice(0, 16) : "";
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

// Show only the last four digits. An organiser console sits on a laptop in a
// cafe or gets screen-shared in a demo; a full roster of volunteer numbers has
// no business being readable over someone's shoulder.
function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `••••${digits.slice(-4)}` : "—";
}

// Roster entries fall back to the raw number when WhatsApp supplies no display
// name (see lib/store.js), so an unmasked number can arrive dressed as a name.
function displayName(entry) {
  if (!entry.name || entry.name === entry.phone) return maskPhone(entry.phone);
  return entry.name;
}

export default function Console() {
  const [volunteers, setVolunteers] = useState([]);
  const [source, setSource] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [mode, setMode] = useState("poll");
  const [message, setMessage] = useState("Hi {name}! Reminder: GIFTIK distribution this Sunday, 9am at Kranji. 🙏");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [roster, setRoster] = useState({ going: [], notGoing: [], campaign: "" });
  const [pillarFilter, setPillarFilter] = useState(ANY);
  const [roleFilter, setRoleFilter] = useState(ANY);
  const [typeFilter, setTypeFilter] = useState(ANY);
  const [loading, setLoading] = useState(true);
  const [needsSync, setNeedsSync] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [markingAttended, setMarkingAttended] = useState(() => new Set());

  // ─── Events ────────────────────────────────────────────────────────────────
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // event being edited, or null
  const [form, setForm] = useState(BLANK_EVENT);
  const [eventError, setEventError] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);
  const [dashboardTab, setDashboardTab] = useState("console");

  const activeEvent = events.find((e) => e.id === eventId) || null;

  // ─── Load contacts ─────────────────────────────────────────────────────────
  const loadVolunteers = useCallback(
    () =>
      fetch("/api/volunteers")
        .then((r) => r.json())
        .then((d) => {
          if (d.error) return setError(d.error);
          setVolunteers(d.volunteers);
          setSource(d.source);
          setNeedsSync(Boolean(d.needsSync));
          // Pre-select everyone who hasn't opted out.
          setSelected(
            new Set(d.volunteers.filter((v) => !v.optedOut).map((v) => v.phone))
          );
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    loadVolunteers();
  }, [loadVolunteers]);

  async function syncVolunteers() {
    setSyncing(true);
    setError("");
    setSyncResult(null);
    try {
      const res = await fetch("/api/volunteers/sync", { method: "POST" });
      const d = await res.json();
      if (d.error) return setError(d.error);
      setSyncResult(d);
      await loadVolunteers();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  // ─── Events ────────────────────────────────────────────────────────────────
  const loadEvents = useCallback(
    (selectId) =>
      fetch("/api/events")
        .then((r) => r.json())
        .then((d) => {
          if (d.error) return setEventError(d.error);
          setEvents(d.events || []);
          setEventId((current) => {
            if (selectId) return selectId;
            // Keep the current selection if it survived; otherwise pick the first.
            if (current && d.events.some((e) => e.id === current)) return current;
            return d.events?.[0]?.id || "";
          });
        })
        .catch((e) => setEventError(e.message)),
    []
  );

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  async function saveEvent(e) {
    e.preventDefault();
    setSavingEvent(true);
    setEventError("");
    try {
      const res = await fetch(
        editing ? `/api/events/${editing.id}` : "/api/events",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (data.error) return setEventError(data.error);
      await loadEvents(data.event.id);
      setShowForm(false);
      setEditing(null);
      setForm(BLANK_EVENT);
    } catch (err) {
      setEventError(err.message);
    } finally {
      setSavingEvent(false);
    }
  }

  async function removeEvent(ev) {
    // Registrations cascade — say so plainly rather than after the fact.
    if (
      !confirm(
        `Delete "${ev.name}"? Its roster (${
          ev.id === eventId ? roster.going.length + roster.notGoing.length : "all"
        } responses) is deleted too. This cannot be undone.`
      )
    ) {
      return;
    }
    setEventError("");
    try {
      const res = await fetch(`/api/events/${ev.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) return setEventError(data.error);
      await loadEvents();
    } catch (err) {
      setEventError(err.message);
    }
  }

  // ─── Roster, refreshed while you watch ─────────────────────────────────────
  // Depends on the selected event — without it in the deps the interval would
  // keep polling whichever event was selected when the page first rendered.
  const campaign = activeEvent?.name;
  const loadRoster = useCallback(() => {
    if (!campaign) return;
    fetch(`/api/roster?campaign=${encodeURIComponent(campaign)}`)
      .then((r) => r.json())
      .then((d) => !d.error && setRoster(d))
      .catch(() => {});
  }, [campaign]);

  useEffect(() => {
    loadRoster();
    const t = setInterval(loadRoster, 3000); // the roster ticking up live is the demo moment
    return () => clearInterval(t);
  }, [loadRoster]);

  const toggle = (phone) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(phone) ? next.delete(phone) : next.add(phone);
      return next;
    });

  // Filter options come from the sheet itself, so whatever labels the Google
  // Form uses (emoji and all) just work — nothing to keep in sync here.
  const pillarOptions = useMemo(() => {
    const set = new Set();
    volunteers.forEach((v) => (v.pillars || []).forEach((p) => set.add(p)));
    return [...set].sort();
  }, [volunteers]);

  const roleOptions = useMemo(() => {
    const set = new Set();
    volunteers.forEach((v) => (v.roles || []).forEach((r) => set.add(r)));
    return [...set].sort();
  }, [volunteers]);

  const typeOptions = useMemo(() => {
    const set = new Set();
    volunteers.forEach((v) => v.type && set.add(v.type));
    return [...set].sort();
  }, [volunteers]);

  // Keyed by phone so the roster can look up "has this person attended
  // before, and have they attended *this* event already" without a second
  // fetch. Beneficiaries don't carry eventsAttended — that naturally excludes
  // them from the attendance control below, since the loyalty ledger is a
  // volunteer concept.
  const volunteerByPhone = useMemo(() => {
    const map = new Map();
    volunteers.forEach((v) => map.set(v.phone, v));
    return map;
  }, [volunteers]);

  const visible = useMemo(
    () =>
      volunteers.filter(
        (v) =>
          (typeFilter === ANY || v.type === typeFilter) &&
          (pillarFilter === ANY || (v.pillars || []).includes(pillarFilter)) &&
          (roleFilter === ANY || (v.roles || []).includes(roleFilter))
      ),
    [volunteers, typeFilter, pillarFilter, roleFilter]
  );

  // "Select all" and the send both act on what you can currently see — filtering
  // to Tamil speakers and hitting send should not quietly include everyone else.
  const selectable = visible.filter((v) => !v.optedOut);
  const allSelected = selectable.length > 0 && selectable.every((v) => selected.has(v.phone));

  // Who actually gets the message. Selections survive a filter change, so this
  // is intersected with the visible list — the button count and the send must
  // never disagree with what's on screen.
  const chosen = visible.filter((v) => selected.has(v.phone));
  const hiddenSelected = selected.size - chosen.length;

  async function send() {
    setSending(true);
    setError("");
    setResult(null);
    try {
      const recipients = chosen;
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, recipients, message, eventId }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
      loadRoster();
    }
  }

  const answered = new Set([...roster.going, ...roster.notGoing].map((r) => r.phone));
  const awaiting = chosen.filter((v) => !answered.has(v.phone)).length;

  // Readiness's "re-invite these N past volunteers" suggestion hands off here:
  // select exactly those people, clear any filter hiding them, switch to the
  // RSVP poll (already wired to this event's question and roster), and let
  // the organiser review before sending — nothing goes out automatically.
  function reinvite(recipients) {
    setSelected(new Set(recipients.map((r) => r.phone)));
    setTypeFilter(ANY);
    setPillarFilter(ANY);
    setRoleFilter(ANY);
    setMode("poll");
    document.getElementById("compose-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function markAttended(phone) {
    if (!activeEvent || markingAttended.has(phone)) return;
    setMarkingAttended((prev) => new Set(prev).add(phone));
    try {
      const res = await fetch(`/api/volunteers/${encodeURIComponent(phone)}/attended`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventName: activeEvent.name }),
      });
      const data = await res.json();
      if (data.error) return setError(data.error);
      setVolunteers((prev) =>
        prev.map((v) => (v.phone === phone ? { ...v, eventsAttended: data.eventsAttended } : v))
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setMarkingAttended((prev) => {
        const next = new Set(prev);
        next.delete(phone);
        return next;
      });
    }
  }

  return (
    <div className="wrap">
      <header className="top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo.png" alt="Passion To Serve" />
        <div>
          <h1>Passion To Serve — Event Console</h1>
          <p>Broadcast to volunteers on WhatsApp, and watch the roster fill.</p>
        </div>
      </header>

      {/* ── Event: what everything below is scoped to ─────────────────── */}
      <section className="card">
        <div className="between" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Event</h2>
          {!showForm && (
            <button
              onClick={() => {
                setEditing(null);
                setForm(BLANK_EVENT);
                setEventError("");
                setShowForm(true);
              }}
            >
              + New event
            </button>
          )}
        </div>

        {events.length === 0 && !eventError && (
          <p className="muted">No events yet. Create one to start sending.</p>
        )}

        {events.length > 0 && (
          <div className="row" style={{ flexWrap: "wrap" }}>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              aria-label="Active event"
              style={{ minWidth: 240 }}
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>

            {activeEvent && !activeEvent.readOnly && (
              <>
                <button
                  onClick={() => {
                    setEditing(activeEvent);
                    setForm({
                      ...BLANK_EVENT,
                      ...activeEvent,
                      starts_at: toLocalInput(activeEvent.starts_at),
                      capacity: activeEvent.capacity ?? "",
                      pillar: activeEvent.pillar ?? "",
                      track: activeEvent.track ?? "",
                      venue: activeEvent.venue ?? "",
                    });
                    setEventError("");
                    setShowForm(true);
                  }}
                >
                  Edit
                </button>
                <button onClick={() => removeEvent(activeEvent)}>Delete</button>
              </>
            )}
          </div>
        )}

        {activeEvent && !showForm && (
          <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
            {formatWhen(activeEvent.starts_at)}
            {activeEvent.venue ? ` · ${activeEvent.venue}` : ""}
            {activeEvent.pillar ? ` · ${activeEvent.pillar}` : ""}
            {activeEvent.capacity ? ` · capacity ${activeEvent.capacity}` : ""}
            <br />
            Poll asks: “{activeEvent.question}”
          </p>
        )}

        {activeEvent?.readOnly && (
          <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
            Read-only fallback from <code>lib/config.js</code> — set{" "}
            <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            to manage real events.
          </p>
        )}

        {showForm && (
          <form onSubmit={saveEvent} style={{ marginTop: 14 }}>
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
              <button className="primary" type="submit" disabled={savingEvent}>
                {savingEvent
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Create event"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                  setEventError("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {eventError && <div className="err">{eventError}</div>}
      </section>

      {activeEvent && !activeEvent.readOnly && (
        <>
          <div className="seg" style={{ marginBottom: 16 }}>
            <button
              className={dashboardTab === "console" ? "on" : ""}
              onClick={() => setDashboardTab("console")}
            >
              Console
            </button>
            <button
              className={dashboardTab === "recommendations" ? "on" : ""}
              onClick={() => setDashboardTab("recommendations")}
            >
              Recommendations
            </button>
          </div>

          {dashboardTab === "recommendations" ? (
            <ReadinessScore eventId={activeEvent.id} onReinvite={reinvite} />
          ) : (
            <>
              <HeadcountDashboard eventId={activeEvent.id} />
              <LogisticsPartners eventId={activeEvent.id} />
              <TaskBoard eventId={activeEvent.id} />
            </>
          )}
        </>
      )}

      <div className="grid">
        {/* ── Left: recipients + compose ───────────────────────────────── */}
        <div>
          <section className="card">
            <div className="between" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Recipients</h2>
              <span className="row">
                <span className="muted">{source}</span>
                <button onClick={syncVolunteers} disabled={syncing}>
                  {syncing ? "Syncing…" : "Sync from form"}
                </button>
              </span>
            </div>

            {/* Reading the sheet directly means Google's CDN can lag several
                minutes behind a new signup — say so rather than let it look
                like a bug. */}
            {needsSync && (
              <div className="ok" style={{ marginTop: 0, marginBottom: 10 }}>
                Reading the Google Sheet directly, which can lag a few minutes
                behind new signups. Sync to load them into the database.
              </div>
            )}

            {syncResult && (
              <div className="ok" style={{ marginTop: 0, marginBottom: 10 }}>
                Synced — {syncResult.added} added · {syncResult.updated} updated ·{" "}
                {syncResult.unchanged} unchanged
                {syncResult.skipped > 0 &&
                  ` · ${syncResult.skipped} skipped (no usable phone)`}
              </div>
            )}

            {loading && <p className="muted">Loading contacts…</p>}

            {/* An empty sheet is a real state, not a stuck spinner — say so. */}
            {!loading && !error && volunteers.length === 0 && (
              <p className="muted">
                No signups yet. Responses appear here as people submit the Google Form.
              </p>
            )}

            {volunteers.length > 0 && (
              <>
                {(typeOptions.length > 1 ||
                  pillarOptions.length > 0 ||
                  roleOptions.length > 0) && (
                  <div className="row" style={{ marginBottom: 10, flexWrap: "wrap" }}>
                    {/* Only worth showing once both kinds of people exist. */}
                    {typeOptions.length > 1 && (
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        aria-label="Filter by volunteer or beneficiary"
                      >
                        <option value={ANY}>Everyone</option>
                        {typeOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}s
                          </option>
                        ))}
                      </select>
                    )}
                    {pillarOptions.length > 0 && (
                      <select
                        value={pillarFilter}
                        onChange={(e) => setPillarFilter(e.target.value)}
                        aria-label="Filter by pillar"
                      >
                        <option value={ANY}>All pillars</option>
                        {pillarOptions.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    )}
                    {roleOptions.length > 0 && (
                      <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        aria-label="Filter by preferred role"
                      >
                        <option value={ANY}>All roles</option>
                        {roleOptions.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    )}
                    {(pillarFilter !== ANY ||
                      roleFilter !== ANY ||
                      typeFilter !== ANY) && (
                      <button
                        onClick={() => {
                          setPillarFilter(ANY);
                          setRoleFilter(ANY);
                          setTypeFilter(ANY);
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}

                <div className="between" style={{ marginBottom: 6 }}>
                  <label className="row" style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          // Only ever add/remove what's on screen, so a filtered
                          // "select all" can't silently touch hidden people.
                          selectable.forEach((v) =>
                            allSelected ? next.delete(v.phone) : next.add(v.phone)
                          );
                          return next;
                        })
                      }
                    />
                    <span className="muted">Select all</span>
                  </label>
                  <span className="muted">
                    {chosen.length} of {visible.length} selected
                    {visible.length !== volunteers.length && ` (${volunteers.length} total)`}
                  </span>
                </div>

                {visible.length === 0 ? (
                  <p className="muted">No one matches this filter.</p>
                ) : (
                  <div className="list">
                    {visible.map((v) => (
                      <label key={v.phone} className={`person${v.optedOut ? " out" : ""}`}>
                        <input
                          type="checkbox"
                          checked={selected.has(v.phone)}
                          disabled={v.optedOut}
                          onChange={() => toggle(v.phone)}
                        />
                        <span className="nm">
                          {v.name || "—"}
                          {(v.pillars?.length > 0 || v.roles?.length > 0) && (
                            <span className="sub">
                              {[...(v.pillars || []), ...(v.roles || [])]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </span>
                        {v.optedOut && <span className="tag">opted out</span>}
                        <span className="ph">{maskPhone(v.phone)}</span>
                      </label>
                    ))}
                  </div>
                )}

                {hiddenSelected > 0 && (
                  <p className="muted" style={{ marginTop: 6 }}>
                    {hiddenSelected} more selected outside this filter — they won&apos;t be sent to.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="card" id="compose-section">
            <h2>Compose</h2>

            <div className="seg" style={{ marginBottom: 14 }}>
              <button className={mode === "poll" ? "on" : ""} onClick={() => setMode("poll")}>
                RSVP poll
              </button>
              <button className={mode === "text" ? "on" : ""} onClick={() => setMode("text")}>
                Text message
              </button>
            </div>

            {mode === "poll" ? (
              <p className="muted" style={{ margin: "0 0 14px" }}>
                Sends a Yes/No poll asking “{activeEvent?.question}”. Votes land on the
                roster automatically. Change the wording by editing the event above.
              </p>
            ) : (
              <>
                <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
                <p className="muted" style={{ margin: "6px 0 14px" }}>
                  <code>{"{name}"}</code> is replaced with each volunteer&apos;s first name.
                </p>
              </>
            )}

            <div className="row">
              <button className="primary" onClick={send} disabled={sending || chosen.length === 0}>
                {sending
                  ? `Sending to ${chosen.length}…`
                  : `Send ${mode === "poll" ? "poll" : "message"} to ${chosen.length}`}
              </button>
              <span className="muted">~1.5s between sends (ban-safety)</span>
            </div>

            {error && <div className="err">{error}</div>}

            {result && (
              <div className="ok">
                Sent {result.sent} · Failed {result.failed} · Skipped {result.skipped}
                {result.results.some((r) => r.status !== "sent") && (
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                    {result.results
                      .filter((r) => r.status !== "sent")
                      .map((r) => (
                        <li key={r.phone}>
                          {r.name || maskPhone(r.phone)} — {r.status}: {r.reason}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>

        {/* ── Right: live roster ───────────────────────────────────────── */}
        <section className="card">
          <div className="between" style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0 }}>Roster</h2>
            <span className="live">
              <span className="pulse" /> live
            </span>
          </div>

          <div className="counts">
            <div className="count yes">
              <div className="n">{roster.going.length}</div>
              <div className="l">Going</div>
            </div>
            <div className="count no">
              <div className="n">{roster.notGoing.length}</div>
              <div className="l">Can&apos;t</div>
            </div>
            <div className="count">
              <div className="n">{awaiting}</div>
              <div className="l">Awaiting</div>
            </div>
          </div>

          {roster.going.length + roster.notGoing.length === 0 ? (
            <p className="muted">
              No responses yet. Send the poll, then tap an option on a phone — replies appear here
              within a few seconds.
            </p>
          ) : (
            <div>
              {[...roster.going, ...roster.notGoing].map((r) => {
                const vol = volunteerByPhone.get(r.phone);
                // The loyalty ledger only makes sense for confirmed volunteers
                // (not "can't make it", not beneficiaries — they have no
                // eventsAttended field at all).
                const canMarkAttendance =
                  r.answer === "yes" && Array.isArray(vol?.eventsAttended) && activeEvent;
                const alreadyAttended =
                  canMarkAttendance && vol.eventsAttended.includes(activeEvent.name);

                return (
                  <div key={r.phone + r.answer} className={`rosterline ${r.answer}`}>
                    <span className="dot" />
                    <span className="who">
                      {displayName(r)}
                      <div className="muted">{r.raw}</div>
                    </span>
                    <span className="when">
                      {new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {canMarkAttendance &&
                      (alreadyAttended ? (
                        <span className="tag">attended</span>
                      ) : (
                        <button
                          onClick={() => markAttended(r.phone)}
                          disabled={markingAttended.has(r.phone)}
                        >
                          {markingAttended.has(r.phone) ? "Marking…" : "Mark attended"}
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
          )}

          <p className="muted" style={{ marginTop: 16, marginBottom: 0 }}>
            Showing <strong>{activeEvent?.name || "—"}</strong>. Inbound replies need{" "}
            <code>npm run listen</code> locally, or GreenAPI&apos;s webhookUrl pointed at{" "}
            <code>/api/webhook</code> once deployed.
          </p>
        </section>
      </div>
    </div>
  );
}
