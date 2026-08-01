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
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

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
          recipients,
          message,
          eventId: event?.id,
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
        <p className="muted" style={{ margin: "0 0 14px" }}>
          Sends a Yes/No poll asking “{event?.question}”. Votes land on the
          roster automatically. Change the wording by editing the event.
        </p>
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
        </>
      )}

      <div className="row">
        <button
          className="primary"
          onClick={send}
          disabled={sending || recipients.length === 0}
        >
          {sending
            ? `Sending to ${recipients.length}…`
            : `Send ${mode === "poll" ? "poll" : "message"} to ${recipients.length}`}
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
