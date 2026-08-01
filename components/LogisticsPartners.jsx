"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Logistics partners for the active event — transport, warehouse, venue
 * contacts. A minimal name + confirmed toggle; feeds the Readiness Score's
 * third input alongside headcount and the task board.
 */
export default function LogisticsPartners({ eventId }) {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    if (!eventId) return;
    fetch(`/api/events/${eventId}/partners`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : (setError(""), setPartners(d.partners))))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function addPartner(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}/partners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.error) return setError(data.error);
      setPartners((prev) => [...prev, data.partner]);
      setName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function toggleConfirmed(partner) {
    const prev = partners;
    setPartners((cur) =>
      cur.map((p) => (p.id === partner.id ? { ...p, confirmed: !p.confirmed } : p))
    );
    try {
      const res = await fetch(`/api/partners/${partner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: !partner.confirmed }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setPartners(prev);
      }
    } catch (err) {
      setError(err.message);
      setPartners(prev);
    }
  }

  async function removePartner(id) {
    const prev = partners;
    setPartners((cur) => cur.filter((p) => p.id !== id));
    try {
      const res = await fetch(`/api/partners/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setPartners(prev);
      }
    } catch (err) {
      setError(err.message);
      setPartners(prev);
    }
  }

  if (loading) return <section className="pf-panel pf-empty">Loading logistics partners…</section>;

  return (
    <section className="pf-panel" aria-labelledby="partners-title">
      <div className="pf-panel-head">
        <h3 id="partners-title">Logistics Partners</h3>
        <span className="pf-live-flag">
          {partners.filter((p) => p.confirmed).length} of {partners.length} confirmed
        </span>
      </div>

      <form className="pf-add-task" onSubmit={addPartner}>
        <label style={{ flex: 1 }}>
          Partner
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="SG Trans Logistics"
            required
          />
        </label>
        <button className="pf-btn pf-primary" type="submit" disabled={adding || !name.trim()}>
          {adding ? "Adding…" : "Add partner"}
        </button>
      </form>

      {error && <div className="err">{error}</div>}

      {partners.length === 0 ? (
        <p className="pf-empty">No logistics partners added for this event yet.</p>
      ) : (
        <ul className="pf-partner-list">
          {partners.map((p) => (
            <li key={p.id} className="pf-partner-row">
              <label className="pf-partner-check">
                <input
                  type="checkbox"
                  checked={p.confirmed}
                  onChange={() => toggleConfirmed(p)}
                />
                <span>{p.name}</span>
              </label>
              <span className={`pf-pill ${p.confirmed ? "pf-good" : "pf-critical"}`}>
                <span className="pf-pip" />
                {p.confirmed ? "Confirmed" : "Not yet"}
              </span>
              <button
                className="pf-task-delete"
                type="button"
                onClick={() => removePartner(p.id)}
                aria-label={`Remove ${p.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
