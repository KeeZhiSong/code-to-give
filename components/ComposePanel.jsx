"use client";

// Compose and send — an RSVP poll, or a text broadcast with {name} merge.
//
// The one screen with real-world consequences: it messages actual people on
// WhatsApp. Sends are sequential with a delay server-side (ban-safety); the
// count on the button always matches what's actually selected and visible.

import { useState } from "react";

const DEFAULT_TEXT =
  "Hi {name}! Reminder: GIFTIK distribution this Sunday, 9am at Kranji. 🙏";

export default function ComposePanel({ event, recipients, onSent }) {
  const [mode, setMode] = useState("poll");
  const [message, setMessage] = useState(DEFAULT_TEXT);
  const [includeDetails, setIncludeDetails] = useState(true);
  const [welcomeOnly, setWelcomeOnly] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // Only worth offering if the event actually has something to say.
  const hasDetails = Boolean(
    event &&
    (event.starts_at ||
      event.venue ||
      event.meeting_point ||
      event.what_to_bring ||
      event.dress_code ||
      event.description),
  );

  // A welcome/intro text shouldn't repeat on someone who's already had one —
  // skip anyone with prior event history when this is checked.
  const repeatsSelected = recipients.filter(
    (r) => Array.isArray(r.eventsAttended) && r.eventsAttended.length > 0,
  ).length;
  const sendRecipients =
    mode === "text" && welcomeOnly
      ? recipients.filter(
          (r) =>
            Array.isArray(r.eventsAttended) && r.eventsAttended.length === 0,
        )
      : recipients;

  async function send() {
    setSending(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          recipients: sendRecipients,
          message,
          eventId: event?.id,
          includeDetails: includeDetails && hasDetails,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
      onSent?.();
    }
  }

  return (
    <section className="card" id="compose-section">
      <h2>Compose</h2>

      <div className="seg" style={{ marginBottom: 14 }}>
        <button
          className={mode === "poll" ? "on" : ""}
          onClick={() => setMode("poll")}
        >
          RSVP poll
        </button>
        <button
          className={mode === "text" ? "on" : ""}
          onClick={() => setMode("text")}
        >
          Text message
        </button>
      </div>

      {mode === "poll" ? (
        <>
          <p className="muted" style={{ margin: "0 0 10px" }}>
            Sends a Yes/No poll asking “{event?.question}”. Votes land on the
            roster automatically. Change the wording by editing the event.
          </p>

          {hasDetails ? (
            <label
              className="row"
              style={{ cursor: "pointer", marginBottom: 14 }}
            >
              <input
                type="checkbox"
                checked={includeDetails}
                onChange={(e) => setIncludeDetails(e.target.checked)}
              />
              <span className="muted">
                Send event details first — date, venue, what to bring.{" "}
                <strong>Doubles the messages sent.</strong>
              </span>
            </label>
          ) : (
            <p className="muted" style={{ margin: "0 0 14px" }}>
              No event details to send yet — add a venue, time or what to bring
              in Settings and they&apos;ll go out with the invite.
            </p>
          )}
        </>
      ) : (
        <>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="muted" style={{ margin: "6px 0 14px" }}>
            <code>{"{name}"}</code> is replaced with each recipient&apos;s first
            name.
          </p>

          {repeatsSelected > 0 && (
            <label
              className="row"
              style={{ cursor: "pointer", marginBottom: 14 }}
            >
              <input
                type="checkbox"
                checked={welcomeOnly}
                onChange={(e) => setWelcomeOnly(e.target.checked)}
              />
              <span className="muted">
                This is a welcome/intro message — skip {repeatsSelected}{" "}
                volunteer{repeatsSelected === 1 ? "" : "s"} who&apos;ve already
                been sent one.
              </span>
            </label>
          )}
        </>
      )}

      <div className="row">
        <button
          className="primary"
          onClick={send}
          disabled={sending || sendRecipients.length === 0}
        >
          {sending
            ? `Sending to ${sendRecipients.length}…`
            : `Send ${mode === "poll" ? "poll" : "message"} to ${sendRecipients.length}`}
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
                    {r.name || "—"} — {r.status}: {r.reason}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
