"use client";

import { useCallback, useEffect, useState } from "react";

function ratioClass(confirmed, target) {
  if (target == null) return "";
  return confirmed >= target ? "pf-good" : "pf-critical";
}

/** The read-only tiles handed to transport/logistics partners — counts only, no controls. */
export default function ShareHeadcount({ eventId, initialData }) {
  const [data, setData] = useState(initialData);

  const load = useCallback(() => {
    fetch(`/api/events/${eventId}/headcount`)
      .then((r) => r.json())
      .then((d) => !d.error && setData(d))
      .catch(() => {});
  }, [eventId]);

  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (!data) return <p className="pf-empty">Headcount unavailable.</p>;

  const { volunteers, beneficiaries } = data;

  return (
    <div className="pf-stat-grid">
      <div className="pf-stat-tile">
        <span className="pf-eyebrow">Confirmed volunteers</span>
        <div className="pf-stat-figure pf-tabular">
          {volunteers.confirmed}
          {volunteers.target != null && <span className="pf-of"> of {volunteers.target} target</span>}
        </div>
        {volunteers.target != null && (
          <div className="pf-bar-track">
            <div
              className={`pf-bar-fill ${ratioClass(volunteers.confirmed, volunteers.target)}`}
              style={{ width: `${Math.min(100, (volunteers.confirmed / volunteers.target) * 100)}%` }}
              role="progressbar"
              aria-valuenow={volunteers.confirmed}
              aria-valuemin={0}
              aria-valuemax={volunteers.target}
            />
          </div>
        )}
      </div>

      <div className="pf-stat-tile">
        <span className="pf-eyebrow">Waitlisted volunteers</span>
        <div className="pf-stat-figure pf-tabular">{volunteers.waitlisted}</div>
      </div>

      <div className="pf-stat-tile">
        <span className="pf-eyebrow">Confirmed beneficiaries</span>
        <div className="pf-stat-figure pf-tabular">{beneficiaries.confirmed}</div>
      </div>
    </div>
  );
}
