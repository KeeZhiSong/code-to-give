"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function ratioClass(confirmed, target) {
  if (target == null) return "";
  if (confirmed >= target) return "pf-good";
  return "pf-critical";
}

/**
 * Live Headcount Dashboard — confirmed/waitlisted volunteers and confirmed
 * beneficiaries for the active event, plus a read-only link to hand to a
 * transport or warehouse partner (see app/share/[id]).
 */
export default function HeadcountDashboard({ eventId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [origin, setOrigin] = useState("");
  const toastTimer = useRef(null);

  const load = useCallback(() => {
    if (!eventId) return;
    fetch(`/api/events/${eventId}/headcount`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : (setError(""), setData(d))))
      .catch((e) => setError(e.message));
  }, [eventId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  async function copyLink() {
    const url = `${origin}/share/${eventId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard permission denied — link is still visible to copy by hand */
    }
    showToast("Link copied");
  }

  if (error) return <section className="pf-panel">{error}</section>;
  if (!data) return <section className="pf-panel pf-empty">Loading headcount…</section>;

  const { volunteers, beneficiaries } = data;

  return (
    <section className="pf-panel" aria-labelledby="headcount-title">
      <div className="pf-panel-head">
        <h3 id="headcount-title">Live Headcount</h3>
        <span className="pf-live-flag">
          <span className="pf-live-dot" aria-hidden="true" />
          Updates every few seconds
        </span>
      </div>

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
          <div className="pf-stat-note">Auto-promoted the moment a confirmed volunteer drops out.</div>
        </div>

        <div className="pf-stat-tile">
          <span className="pf-eyebrow">Confirmed beneficiaries</span>
          <div className="pf-stat-figure pf-tabular">{beneficiaries.confirmed}</div>
          <div className="pf-stat-note">Not capacity-gated — everyone who says yes is counted in.</div>
        </div>
      </div>

      <div className="pf-share-row">
        <div className="pf-share-info">
          <div className="pf-share-label">Share with transport &amp; logistics partners</div>
          <div className="pf-share-link pf-tabular">{origin ? `${origin}/share/${eventId}` : "…"}</div>
          <div className="pf-share-help">
            Read-only, no login required — safe to hand to a partner who just needs headcounts.
          </div>
        </div>
        <button className="pf-btn" type="button" onClick={copyLink} disabled={!origin}>
          Copy link
        </button>
      </div>

      <div className={`pf-toast${toast ? " pf-show" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </section>
  );
}
