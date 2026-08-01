"use client";

// Compact readiness pill for the events index — the reason to open one event
// over another. Loads per row and stays quiet if it can't: a badge failing
// must never break the list it sits in.

import { useEffect, useState } from "react";

export default function EventReadinessBadge({ eventId }) {
  const [score, setScore] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/readiness`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && typeof d.score === "number") setScore(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (!score) return <span className="ev-score muted">—</span>;

  return (
    <span className={`ev-score ${score.label === "on-track" ? "ok" : "warn"}`}>
      {score.score}%
    </span>
  );
}
