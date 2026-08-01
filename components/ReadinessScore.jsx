"use client";

import { useCallback, useEffect, useState } from "react";

const DIMENSIONS = [
  { key: "volunteers", label: "Headcount vs. target" },
  { key: "tasks", label: "Task board complete" },
  { key: "partners", label: "Logistics partners confirmed" },
];

/**
 * Event Readiness Score — one number from three inputs that already live
 * elsewhere (headcount, task board, logistics partners), plus a concrete
 * next action when it's low. See lib/readiness.js for how it's computed.
 */
export default function ReadinessScore({ eventId, onReinvite }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!eventId) return;
    fetch(`/api/events/${eventId}/readiness`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : (setError(""), setData(d))))
      .catch((e) => setError(e.message));
  }, [eventId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (error) return <section className="pf-panel">{error}</section>;
  if (!data) return <section className="pf-panel pf-empty">Loading readiness…</section>;

  const onTrack = data.label === "on-track";

  return (
    <section className="pf-panel" aria-labelledby="readiness-title">
      <div className="pf-panel-head">
        <h3 id="readiness-title">Event Readiness</h3>
        <span className={`pf-pill ${onTrack ? "pf-good" : "pf-critical"}`}>
          <span className="pf-pip" />
          {onTrack ? "On track" : "Needs attention"}
        </span>
      </div>

      <div className="pf-score-row">
        <div className="pf-score-figure pf-tabular">
          {data.score}
          <span className="pf-of">%</span>
        </div>
        <div className="pf-breakdown">
          {DIMENSIONS.map((d) => (
            <div className="pf-breakdown-row" key={d.key}>
              <span className="pf-breakdown-label">{d.label}</span>
              <div className="pf-bar-track">
                <div
                  className={`pf-bar-fill ${data.breakdown[d.key] >= 80 ? "pf-good" : "pf-critical"}`}
                  style={{ width: `${data.breakdown[d.key]}%` }}
                  role="progressbar"
                  aria-valuenow={data.breakdown[d.key]}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <span className="pf-breakdown-pct pf-tabular">{data.breakdown[d.key]}%</span>
            </div>
          ))}
        </div>
      </div>

      {!onTrack && data.suggestions.length > 0 && (
        <ul className="pf-suggestions">
          {data.suggestions.map((s, i) => (
            <li key={i} className="pf-suggestion">
              <span>{s.text}</span>
              {s.type === "volunteers" && s.recipients?.length > 0 && (
                <button
                  className="pf-btn pf-primary pf-suggestion-action"
                  type="button"
                  onClick={() => onReinvite?.(s.recipients)}
                >
                  Re-invite
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
