"use client";

// Readiness gauge for the events index — the reason to open one event over
// another. A real radial progress ring, not a stock icon: the arc IS the
// data (DESIGN.md's "decoration earns its place by carrying real data"
// rule), so this stays legitimate on an Operate surface's front door.
// Loads per card and stays quiet if it can't: a gauge failing must never
// break the grid it sits in.

import { useEffect, useState } from "react";

const SIZE = 56;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function EventReadinessBadge({ eventId, onScore }) {
  const [score, setScore] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/readiness`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && typeof d.score === "number") {
          setScore(d);
          onScore?.(eventId, d);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eventId only — a new onScore identity each render must not re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (!score) {
    return (
      <div className="readiness-ring" aria-hidden="true">
        <span className="muted">—</span>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, score.score));
  const color = score.label === "on-track" ? "var(--yes)" : "var(--no)";
  const offset = CIRCUMFERENCE * (1 - pct / 100);

  return (
    <div
      className="readiness-ring"
      role="img"
      aria-label={`Readiness ${pct}%, ${score.label === "on-track" ? "on track" : "needs attention"}`}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="none" stroke="var(--line)" strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <span className="readiness-ring-figure">{pct}</span>
    </div>
  );
}
