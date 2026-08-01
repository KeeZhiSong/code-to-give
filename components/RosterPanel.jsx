"use client";

// The live roster — who has replied yes, who can't, who hasn't answered.
//
// Polls every few seconds so it fills up while you watch. Also where an
// organiser credits attendance after the event, which is the single writer
// feeding both the re-invite list and the loyalty ledger.

import { useState } from "react";
import { displayName, formatTime } from "@/lib/ui/format";

export default function RosterPanel({
  roster,
  event,
  awaiting,
  peopleByPhone,
  onAttendanceMarked,
}) {
  const [marking, setMarking] = useState(() => new Set());
  const [error, setError] = useState("");
  // Who's mid-send, and who's already been thanked this session. The latter is
  // only remembered in the page — it stops a double-tap sending twice, but a
  // refresh forgets, because nothing records it server-side.
  const [thanking, setThanking] = useState(() => new Set());
  const [thanked, setThanked] = useState(() => new Set());

  async function markAttended(phone) {
    if (!event || marking.has(phone)) return;
    setMarking((prev) => new Set(prev).add(phone));
    setError("");
    try {
      const res = await fetch(
        `/api/volunteers/${encodeURIComponent(phone)}/attended`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventName: event.name }),
        }
      );
      const data = await res.json();
      if (data.error) return setError(data.error);
      // Reload rather than patch: a beneficiary's attended list comes from the
      // activity log, not the response body, so patching would blank it and
      // make the button reappear.
      await onAttendanceMarked?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setMarking((prev) => {
        const next = new Set(prev);
        next.delete(phone);
        return next;
      });
    }
  }

  /**
   * Send the post-event thank-you — what their hours actually amounted to.
   *
   * Separate from marking attendance on purpose. Attendance is a record and
   * can be corrected; this is a message that has left the building and can't.
   */
  async function sendThanks(phone, name) {
    if (!event || thanking.has(phone)) return;
    if (thanked.has(phone) && !confirm(`Send ${name || "them"} another thank-you?`)) {
      return;
    }
    setThanking((prev) => new Set(prev).add(phone));
    setError("");
    try {
      const res = await fetch(`/api/events/${event.id}/impact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name }),
      });
      const data = await res.json();
      if (data.error) return setError(data.error);
      setThanked((prev) => new Set(prev).add(phone));
    } catch (e) {
      setError(e.message);
    } finally {
      setThanking((prev) => {
        const next = new Set(prev);
        next.delete(phone);
        return next;
      });
    }
  }

  const entries = [...roster.going, ...roster.notGoing];

  return (
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

      {error && <div className="err">{error}</div>}

      {entries.length === 0 ? (
        <p className="muted">
          No responses yet. Send the poll, then tap an option on a phone —
          replies appear here within a few seconds.
        </p>
      ) : (
        <div>
          {entries.map((r) => {
            const person = peopleByPhone?.get(r.phone);
            // Only someone who said yes can have turned up, and only a known
            // person can be credited.
            const canMark = r.answer === "yes" && person && event;
            const already =
              canMark && (person.eventsAttended || []).includes(event.name);

            return (
              <div
                key={r.phone + r.answer}
                className={`rosterline ${r.answer}`}
              >
                <span className="dot" />
                <span className="who">
                  {displayName(r)}
                  <div className="muted">{r.raw}</div>
                </span>
                <span className="when">{formatTime(r.at)}</span>
                {canMark &&
                  (already ? (
                    <span className="tag">attended</span>
                  ) : (
                    <button
                      onClick={() => markAttended(r.phone)}
                      disabled={marking.has(r.phone)}
                    >
                      {marking.has(r.phone) ? "Marking…" : "Mark attended"}
                    </button>
                  ))}
                {/* Sits alongside "Mark attended" rather than replacing it —
                    thanking someone and recording that they came are two
                    different decisions, and an organiser may want either. */}
                {canMark && (
                  <button
                    onClick={() => sendThanks(r.phone, person.name)}
                    disabled={thanking.has(r.phone)}
                    title="Send the post-event thank-you"
                  >
                    {thanking.has(r.phone)
                      ? "Sending…"
                      : thanked.has(r.phone)
                        ? "Thanks sent ✓"
                        : "Send thanks"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="muted" style={{ marginTop: 16, marginBottom: 0 }}>
        Inbound replies need GreenAPI&apos;s webhookUrl pointed at{" "}
        <code>/api/webhook</code>, or <code>npm run listen</code> locally.
      </p>
    </section>
  );
}
