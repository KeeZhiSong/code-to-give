"use client";

// The live roster — who has replied yes, who can't, who hasn't answered.
//
// Polls every few seconds so it fills up while you watch. Also where an
// organiser credits attendance after the event, which is the single writer
// feeding both the re-invite list and the loyalty ledger.

import { useEffect, useRef, useState } from "react";
import { displayName, formatTime } from "@/lib/ui/format";

/**
 * Marks a number as having just changed, without touching the number itself.
 *
 * Returns "changed" for a beat after `value` moves, so the caller can flag the
 * container. Deliberately not a count-up: the roster is what an organiser
 * reads to decide manpower, and a value tweening through numbers that were
 * never true is a lie told for decoration.
 */
function useChanged(value, ms = 520) {
  const prev = useRef(value);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setChanged(true);
    const t = setTimeout(() => setChanged(false), ms);
    return () => clearTimeout(t);
  }, [value, ms]);

  return changed ? " changed" : "";
}

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
  const [thankingAll, setThankingAll] = useState(false);
  const [batchResult, setBatchResult] = useState(null);

  // Poll ticks every few seconds; without a marker a headcount moving 3 → 4
  // is invisible to anyone not staring at that exact digit.
  const goingChanged = useChanged(roster.going.length);
  const notGoingChanged = useChanged(roster.notGoing.length);
  const awaitingChanged = useChanged(awaiting);

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

  // Who the batch thank-you goes to: people an organiser has confirmed
  // actually turned up. Deliberately NOT everyone who said yes — the message
  // says "you were one of N volunteers who made this happen", and sending that
  // to a no-show is a lie told warmly.
  const attended = entries.filter((r) => {
    const person = peopleByPhone?.get(r.phone);
    return (
      r.answer === "yes" &&
      person &&
      event &&
      (person.eventsAttended || []).includes(event.name)
    );
  });

  /** Thank everyone who turned up, in one go. */
  async function sendThanksToAll() {
    if (!event || attended.length === 0 || thankingAll) return;
    if (
      !confirm(
        `Send the thank-you message to ${attended.length} ${attended.length === 1 ? "person" : "people"} who attended ${event.name}?`
      )
    ) {
      return;
    }
    setThankingAll(true);
    setError("");
    setBatchResult(null);
    try {
      const res = await fetch(`/api/events/${event.id}/impact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: attended.map((r) => ({
            phone: r.phone,
            name: peopleByPhone?.get(r.phone)?.name || "",
          })),
        }),
      });
      const data = await res.json();
      if (data.error) return setError(data.error);
      setBatchResult(data);
      setThanked((prev) => {
        const next = new Set(prev);
        (data.results || [])
          .filter((r) => r.status === "sent")
          .forEach((r) => next.add(r.phone));
        return next;
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setThankingAll(false);
    }
  }

  return (
    <section className="card">
      <div className="between" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Roster</h2>
        <span className="row">
          {/* Only once somebody has actually been marked attended — before
              that there's nobody it would be truthful to thank. */}
          {attended.length > 0 && (
            <button onClick={sendThanksToAll} disabled={thankingAll}>
              {thankingAll
                ? `Sending… (${attended.length})`
                : `Send thanks to all (${attended.length})`}
            </button>
          )}
          <span className="live">
            <span className="pulse" /> live
          </span>
        </span>
      </div>

      {batchResult && (
        <div className={batchResult.sent === batchResult.total ? "ok" : "err"}>
          Sent to {batchResult.sent} of {batchResult.total}.
          {batchResult.sent < batchResult.total && (
            <>
              {" "}
              {batchResult.results
                .filter((r) => r.status !== "sent")
                .map((r) => `${r.name || r.phone.slice(-4)} — ${r.reason}`)
                .join("; ")}
            </>
          )}
        </div>
      )}

      <div className="counts">
        <div className="count yes">
          <div className={`n${goingChanged}`}>{roster.going.length}</div>
          <div className="l">Going</div>
        </div>
        <div className="count no">
          <div className={`n${notGoingChanged}`}>{roster.notGoing.length}</div>
          <div className="l">Can&apos;t</div>
        </div>
        <div className="count">
          <div className={`n${awaitingChanged}`}>{awaiting}</div>
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
