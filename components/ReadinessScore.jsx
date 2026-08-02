"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const DIMENSIONS = [
  { key: "volunteers", label: "Headcount vs. target" },
  { key: "tasks", label: "Task board complete" },
  { key: "partners", label: "Logistics partners confirmed" },
];

const RING_SIZE = 116;
const RING_STROKE = 9;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// The score AS a ring, not a number beside a decoration — same "graphic
// carries the data" rule as the Events index cards (DESIGN.md), scaled up
// since this is the one figure this whole panel exists to show.
function ReadinessRing({ pct, onTrack }) {
  const offset = RING_CIRCUMFERENCE * (1 - pct / 100);
  const color = onTrack ? "var(--pf-good)" : "var(--pf-critical)";
  return (
    <div className="pf-readiness-ring" role="img" aria-label={`${pct}% ready`}>
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        <circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
          fill="none" stroke="var(--pf-bg-sunken)" strokeWidth={RING_STROKE}
        />
        <circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
          fill="none" stroke={color} strokeWidth={RING_STROKE} strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={offset}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </svg>
      <span className="pf-score-figure pf-tabular">
        {pct}
        <span className="pf-of">%</span>
      </span>
    </div>
  );
}

/**
 * Event Readiness Score — one number from three inputs that already live
 * elsewhere (headcount, task board, logistics partners), plus a concrete
 * next action when it's low. See lib/readiness.js for how it's computed.
 */
export default function ReadinessScore({ eventId }) {
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
        <ReadinessRing pct={Math.max(0, Math.min(100, data.score))} onTrack={onTrack} />
        <div className="pf-breakdown">
          {DIMENSIONS.map((d) => (
            <div className="pf-breakdown-row" key={d.key}>
              <span className="pf-breakdown-label">{d.label}</span>
              <div className="pf-bar-track">
                <div
                  className={`pf-bar-fill ${data.breakdown[d.key] >= 80 ? "pf-good" : "pf-critical"}`}
                  style={{ transform: `scaleX(${data.breakdown[d.key] / 100})` }}
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
                // Hands off to Broadcast by intent, not by listing phone
                // numbers in the URL — that page re-asks this endpoint who it
                // meant, so nothing personal ends up in browser history.
                <Link
                  className="pf-btn pf-primary pf-suggestion-action"
                  href={`/events/${eventId}/broadcast?segment=past-volunteers`}
                >
                  Re-invite
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
