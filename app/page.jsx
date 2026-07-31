"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

// Volunteers who signed up before a form question existed have a blank value
// for it. They must stay visible under "All" — never silently dropped.
const ANY = "__any__";

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
  const [loading, setLoading] = useState(true);

  // ─── Load contacts ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/volunteers")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return setError(d.error);
        setVolunteers(d.volunteers);
        setSource(d.source);
        // Pre-select everyone who hasn't opted out.
        setSelected(new Set(d.volunteers.filter((v) => !v.optedOut).map((v) => v.phone)));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ─── Roster, refreshed while you watch ─────────────────────────────────────
  const loadRoster = useCallback(() => {
    fetch("/api/roster")
      .then((r) => r.json())
      .then((d) => !d.error && setRoster(d))
      .catch(() => {});
  }, []);

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

  const visible = useMemo(
    () =>
      volunteers.filter(
        (v) =>
          (pillarFilter === ANY || (v.pillars || []).includes(pillarFilter)) &&
          (roleFilter === ANY || (v.roles || []).includes(roleFilter))
      ),
    [volunteers, pillarFilter, roleFilter]
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
        body: JSON.stringify({ mode, recipients, message }),
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

  return (
    <div className="wrap">
      <header className="top">
        <h1>Passion To Serve — Event Console</h1>
        <p>Broadcast to volunteers on WhatsApp, and watch the roster fill.</p>
      </header>

      <div className="grid">
        {/* ── Left: recipients + compose ───────────────────────────────── */}
        <div>
          <section className="card">
            <div className="between" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Recipients</h2>
              <span className="muted">{source}</span>
            </div>

            {loading && <p className="muted">Loading contacts…</p>}

            {/* An empty sheet is a real state, not a stuck spinner — say so. */}
            {!loading && !error && volunteers.length === 0 && (
              <p className="muted">
                No signups yet. Responses appear here as people submit the Google Form.
              </p>
            )}

            {volunteers.length > 0 && (
              <>
                {(pillarOptions.length > 0 || roleOptions.length > 0) && (
                  <div className="row" style={{ marginBottom: 10, flexWrap: "wrap" }}>
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
                    {(pillarFilter !== ANY || roleFilter !== ANY) && (
                      <button
                        onClick={() => {
                          setPillarFilter(ANY);
                          setRoleFilter(ANY);
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

          <section className="card">
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
                Sends a Yes/No poll — “Join Sunday&apos;s GIFTIK distribution drive? 🙌”. Votes land
                on the roster automatically. Edit the question in <code>lib/config.js</code>.
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
              {[...roster.going, ...roster.notGoing].map((r) => (
                <div key={r.phone + r.answer} className={`rosterline ${r.answer}`}>
                  <span className="dot" />
                  <span className="who">
                    {displayName(r)}
                    <div className="muted">{r.raw}</div>
                  </span>
                  <span className="when">
                    {new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="muted" style={{ marginTop: 16, marginBottom: 0 }}>
            Requires <code>npm run listen</code> in a second terminal.
          </p>
        </section>
      </div>
    </div>
  );
}
