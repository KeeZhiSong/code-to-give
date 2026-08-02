"use client";

// Shift coverage — who's on each shift, and who backs them up.
//
// Reads and writes go through /api/shifts, not a Supabase client in the
// browser. The service_role key stays on the server, and promoting a standby
// is decided there too, so the page can't nominate whoever it likes.

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import AppHeader from "@/components/AppHeader.jsx";
import { initials } from "@/lib/ui/format";

const STATUS_RANK = { ok: 0, triggered: 1, covered: 2, open: 3 };

const STYLES = `
  .sc-toolbar{ display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; }
  .sc-bulkbar{ display:flex; align-items:center; gap:10px; }
  .sc-bulkbar span.sc-count{ font-family:var(--font-mono); font-size:var(--text-sm); color:var(--muted); }

  .sc-filterbar{ display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-top:14px; }
  .sc-filtergroup{ display:flex; align-items:center; gap:6px; }
  .sc-filtergroup label{
    font-size:var(--text-label); text-transform:uppercase; letter-spacing:0.06em; color:var(--muted);
  }
  button.sc-dirbtn{
    font-family:var(--font-mono); font-size:var(--text-sm); background:var(--card);
    border:1px solid var(--line); color:var(--ink); border-radius:var(--radius-sm); padding:6px 9px; cursor:pointer;
  }
  button.sc-dirbtn:hover{ background:var(--hover-tint); }
  .sc-clearfilters{
    font-size:var(--text-sm); color:var(--muted); cursor:pointer; margin-left:auto; text-decoration:underline;
  }
  .sc-clearfilters:hover{ color:var(--accent); }

  .sc-legend{ display:flex; gap:16px; font-size:var(--text-sm); color:var(--muted); flex-wrap:wrap; margin-top:12px; }
  .sc-legend span{ display:inline-flex; align-items:center; gap:5px; }
  .sc-swatch{ width:8px; height:8px; border-radius:50%; display:inline-block; }

  .sc-table{ width:100%; border-collapse:collapse; font-size:var(--text-base); margin-top:4px; }
  .sc-table thead th{
    text-align:left; font-size:var(--text-label); text-transform:uppercase; letter-spacing:0.06em;
    color:var(--muted); padding:8px 10px; border-bottom:1px solid var(--line); user-select:none; font-weight:600;
  }
  .sc-table thead th.sc-sortable{ cursor:pointer; }
  .sc-table thead th.sc-sortable:hover{ color:var(--accent); }
  .sc-table thead th .sc-arrow{ margin-left:4px; opacity:0.6; }
  .sc-table tbody td{ padding:10px; vertical-align:top; border-bottom:1px solid var(--line); }
  tr.sc-shift-row:hover{ background:var(--hover-tint); }
  tr.sc-shift-row.sc-checked{ background:rgb(from var(--accent) r g b / 8%); }
  td.sc-event{ color:var(--ink); font-weight:550; }
  td.sc-event .sc-sub{ color:var(--muted); font-weight:400; font-size:var(--text-sm); }
  td.sc-date{ font-family:var(--font-mono); color:var(--muted); font-size:var(--text-sm); white-space:nowrap; }
  td.sc-name, td.sc-standby{ font-size:var(--text-sm); }
  .sc-who{ display:inline-flex; align-items:center; gap:6px; color:var(--ink); }
  .sc-arrow2{ color:var(--muted); margin:0 4px; }
  td.sc-check{ width:30px; }
  .sc-root input[type=checkbox]{ width:15px; height:15px; accent-color: var(--accent); cursor:pointer; }

  .sc-badge{
    font-size:var(--text-label); font-weight:600; padding:3px 9px; border-radius:999px;
    display:inline-block; border:1px solid transparent; white-space:nowrap;
  }
  .sc-badge.sc-ok{ color:var(--yes); background:rgb(from var(--yes) r g b / 14%); border-color:rgb(from var(--yes) r g b / 35%); }
  .sc-badge.sc-triggered{ color:var(--pending); background:rgb(from var(--pending) r g b / 16%); border-color:rgb(from var(--pending) r g b / 40%); animation:sc-pulse 1s ease-in-out infinite; }
  .sc-badge.sc-covered{ color:var(--accent); background:rgb(from var(--accent) r g b / 12%); border-color:rgb(from var(--accent) r g b / 35%); }
  .sc-badge.sc-open{ color:var(--no); background:rgb(from var(--no) r g b / 14%); border-color:rgb(from var(--no) r g b / 40%); font-weight:700; }
  @keyframes sc-pulse{ 0%,100%{opacity:1;} 50%{opacity:.5;} }
  @media (prefers-reduced-motion: reduce) { .sc-badge.sc-triggered{ animation:none; } }

  .sc-actioncell{ text-align:right; white-space:nowrap; }

  tr.sc-log-row td{ border-bottom:1px solid var(--line); padding:0; }
  /* grid-template-rows 0fr→1fr instead of max-height/padding: an unknown-height
     collapsible without animating a layout property directly. */
  .sc-logbox{
    display:grid; grid-template-rows:0fr; overflow:hidden;
    transition:grid-template-rows .25s ease;
  }
  .sc-logbox.sc-open{ grid-template-rows:1fr; }
  .sc-logbox-inner{
    overflow:hidden; min-height:0; padding:10px 14px;
    font-family:var(--font-mono); font-size:var(--text-sm); color:var(--muted);
    background:var(--hover-tint);
  }
  .sc-logbox p{ margin:3px 0; animation:sc-rise .15s forwards; }
  .sc-logbox .sc-ok-line{ color:var(--yes); }
  .sc-logbox .sc-warn-line{ color:var(--no); }
  @keyframes sc-rise{ from{opacity:0; transform:translateY(2px);} to{opacity:1; transform:translateY(0);} }
  @media (prefers-reduced-motion: reduce) {
    .sc-logbox{ transition:none; }
    @keyframes sc-rise{ from{opacity:1;} to{opacity:1;} }
  }

  .sc-empty-state{ text-align:center; padding:30px; color:var(--muted); font-size:var(--text-sm); }
`;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function Badge({ status }) {
  const map = {
    ok: ["sc-ok", "confirmed"],
    triggered: ["sc-triggered", "backup triggered"],
    covered: ["sc-covered", "covered by backup"],
    open: ["sc-open", "unfilled"],
  };
  const [cls, label] = map[status] || ["", status];
  return <span className={`sc-badge ${cls}`}>{label}</span>;
}

function Who({ name }) {
  return (
    <span className="sc-who">
      <span className="avatar" aria-hidden="true">{initials(name)}</span>
      {name}
    </span>
  );
}

function StandbyCell({ standby }) {
  if (!standby || !standby.length) return <span className="muted">— queue empty —</span>;
  return standby.map((n, i) => (
    <React.Fragment key={n + i}>
      {i > 0 && <span className="sc-arrow2">→</span>}
      <Who name={n} />
    </React.Fragment>
  ));
}

function PrimaryCell({ primary }) {
  return primary ? <Who name={primary} /> : <span style={{ color: "var(--no)" }}>— unassigned —</span>;
}

export default function VolunteerShiftCoverage() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const shiftsRef = useRef(shifts);
  useEffect(() => { shiftsRef.current = shifts; }, [shifts]);

  const [selected, setSelected] = useState(() => new Set());
  const [eventFilter, setEventFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("asc");
  const [logs, setLogs] = useState({});
  const [logsOpen, setLogsOpen] = useState({});
  const [working, setWorking] = useState({});

  const [error, setError] = useState("");

  // The API already returns the shape this page wants — the primary_volunteer
  // column is renamed server-side in lib/shifts.js.
  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shifts");
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setError("");
        setShifts(data.shifts || []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const eventOptions = useMemo(() => [...new Set(shifts.map((s) => s.event))], [shifts]);

  const visibleShifts = useMemo(() => {
    let list = shifts.filter((s) => {
      if (eventFilter !== "all" && s.event !== eventFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      return true;
    });
    list = list.slice().sort((a, b) => {
      let av, bv;
      if (sortField === "date") { av = a.date; bv = b.date; }
      else if (sortField === "event") { av = a.event; bv = b.event; }
      else if (sortField === "role") { av = a.role; bv = b.role; }
      else { av = STATUS_RANK[a.status]; bv = STATUS_RANK[b.status]; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [shifts, eventFilter, statusFilter, sortField, sortDir]);

  const appendLog = useCallback((id, text, cls) => {
    setLogs((prev) => ({ ...prev, [id]: [...(prev[id] || []), { text, cls }] }));
  }, []);

  /**
   * The primary volunteer has dropped out — hand the shift to the first
   * standby.
   *
   * The server decides who that is and returns what it actually wrote, so the
   * log below reports the outcome rather than predicting it. The pauses
   * between lines are pacing for a watching organiser, not work being done.
   */
  const simulateCancellation = useCallback(
    async (id) => {
      const s = shiftsRef.current.find((x) => x.id === id);
      if (!s || !s.primary) return;

      setLogsOpen((prev) => ({ ...prev, [id]: true }));
      setWorking((prev) => ({ ...prev, [id]: true }));

      await delay(100);
      appendLog(id, `✕ ${s.primary} cancelled — shift now unstaffed`, null);
      if ((s.standby || []).length) {
        setShifts((prev) =>
          prev.map((x) => (x.id === id ? { ...x, status: "triggered" } : x))
        );
        await delay(400);
      }

      let result;
      try {
        const res = await fetch(`/api/shifts/${id}/cover`, { method: "POST" });
        result = await res.json();
        if (result.error) throw new Error(result.error);
      } catch (e) {
        appendLog(id, `⚠ couldn't reassign: ${e.message}`, "sc-warn-line");
        setWorking((prev) => ({ ...prev, [id]: false }));
        // Put the row back the way the server still has it.
        await fetchShifts();
        return;
      }

      const { shift, promoted, remaining } = result;
      setShifts((prev) => prev.map((x) => (x.id === shift.id ? shift : x)));
      setWorking((prev) => ({ ...prev, [id]: false }));

      if (promoted) {
        appendLog(id, `→ next in queue: ${promoted}…`, null);
        await delay(500);
        appendLog(id, `✓ ${promoted} is now primary`, "sc-ok-line");
        await delay(300);
        appendLog(
          id,
          remaining.length
            ? `→ shift reassigned. ${remaining.length} more standby${remaining.length > 1 ? "s" : ""} still on call.`
            : "→ shift reassigned. Standby queue is now empty.",
          null
        );
      } else {
        await delay(300);
        appendLog(id, "⚠ standby queue exhausted — shift is unfilled", "sc-warn-line");
        await delay(300);
        appendLog(id, "→ needs emergency coverage", null);
      }
    },
    [appendLog, fetchShifts]
  );

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll(checked) {
    setSelected((prev) => {
      const next = new Set(prev);
      visibleShifts.forEach((s) => {
        if (s.status !== "open") {
          checked ? next.add(s.id) : next.delete(s.id);
        }
      });
      return next;
    });
  }

  function clearFilters() {
    setEventFilter("all");
    setStatusFilter("all");
    setSortField("date");
    setSortDir("asc");
  }

  function handleBulkCancel() {
    const ids = Array.from(selected);
    setSelected(new Set());
    ids.forEach((id) => simulateCancellation(id));
  }

  function handleResetAll() {
    fetchShifts(); // Refetch clean state from DB
    setSelected(new Set());
    setLogs({});
    setLogsOpen({});
    setWorking({});
  }

  function handleHeaderSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function actionCell(s) {
    if (working[s.id] || s.status === "triggered") {
      return <button className="tiny" disabled>Working…</button>;
    }
    if (s.status === "open") {
      return <span className="muted" style={{ fontSize: "var(--text-label)" }}>needs organizer</span>;
    }
    if (s.primary) {
      return <button className="tiny" onClick={() => simulateCancellation(s.id)}>Simulate cancellation</button>;
    }
    return null;
  }

  const visibleNonOpenIds = visibleShifts.filter((s) => s.status !== "open").map((s) => s.id);
  const selectAllChecked = visibleNonOpenIds.length > 0 && visibleNonOpenIds.every((id) => selected.has(id));

  const headers = [
    { field: "date", label: "Date", width: 88 },
    { field: "event", label: "Event" },
    { field: "role", label: "Role" },
    null,
    null,
    { field: "status", label: "Status" },
  ];

  return (
    <div className="wrap sc-root">
      <style>{STYLES}</style>

      <AppHeader
        title="Shift Coverage"
        subtitle="Every shift has a primary volunteer and an ordered standby queue. If the primary cancels, the next standby is auto-notified — and escalation keeps going if that person cancels too."
      />

      <section className="card">
        <div className="sc-toolbar">
          <div className="sc-bulkbar">
            <span className="sc-count">{selected.size} selected</span>
          </div>
          <div className="sc-bulkbar">
            <button className="tiny" onClick={handleResetAll}>Reload from DB</button>
            <button disabled={selected.size === 0} onClick={handleBulkCancel}>
              Simulate selected cancellations
            </button>
          </div>
        </div>

        <div className="sc-filterbar">
          <div className="sc-filtergroup">
            <label htmlFor="sc-event-filter">Event</label>
            <select id="sc-event-filter" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
              <option value="all">All</option>
              {eventOptions.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
            </select>
          </div>
          <div className="sc-filtergroup">
            <label htmlFor="sc-status-filter">Status</label>
            <select id="sc-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="ok">Confirmed</option>
              <option value="triggered">Backup triggered</option>
              <option value="covered">Covered by backup</option>
              <option value="open">Unfilled</option>
            </select>
          </div>
          <div className="sc-filtergroup">
            <label htmlFor="sc-sort-field">Sort by</label>
            <select id="sc-sort-field" value={sortField} onChange={(e) => setSortField(e.target.value)}>
              <option value="date">Date</option>
              <option value="event">Event</option>
              <option value="role">Role</option>
              <option value="status">Status</option>
            </select>
            <button className="sc-dirbtn" title="Toggle sort direction" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
              {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
            </button>
          </div>
          <span className="sc-clearfilters" onClick={clearFilters}>clear filters</span>
        </div>

        <div className="sc-legend">
          <span><span className="sc-swatch" style={{ background: "var(--yes)" }} />confirmed</span>
          <span><span className="sc-swatch" style={{ background: "var(--pending)" }} />backup triggered</span>
          <span><span className="sc-swatch" style={{ background: "var(--accent)" }} />covered by backup</span>
          <span><span className="sc-swatch" style={{ background: "var(--no)" }} />unfilled</span>
        </div>
      </section>

      <section className="card" style={{ overflowX: "auto" }}>
        <table className="sc-table">
          <thead>
            <tr>
              <th className="sc-check">
                <input type="checkbox" checked={selectAllChecked} onChange={(e) => toggleSelectAll(e.target.checked)} />
              </th>
              {headers.map((h, i) => {
                if (!h) return <th key={i}>{i === 3 ? "Primary" : "Standby queue"}</th>;
                return (
                  <th
                    key={h.field}
                    className="sc-sortable"
                    style={h.width ? { width: h.width } : undefined}
                    onClick={() => handleHeaderSort(h.field)}
                  >
                    {h.label}
                    <span className="sc-arrow">
                      {sortField === h.field ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </span>
                  </th>
                );
              })}
              <th style={{ width: 180 }} />
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={8} className="sc-empty-state" style={{ color: "var(--no)" }}>
                  Couldn&apos;t load shifts — {error}
                </td>
              </tr>
            ) : loading ? (
              <tr><td colSpan={8} className="sc-empty-state">Loading shifts…</td></tr>
            ) : visibleShifts.length === 0 ? (
              <tr><td colSpan={8} className="sc-empty-state">No shifts match the current filters.</td></tr>
            ) : (
              visibleShifts.map((s) => (
                <React.Fragment key={s.id}>
                  <tr className={`sc-shift-row${selected.has(s.id) ? " sc-checked" : ""}`}>
                    <td className="sc-check">
                      <input
                        type="checkbox"
                        disabled={s.status === "open"}
                        checked={selected.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                      />
                    </td>
                    <td className="sc-date">{formatDate(s.date)}</td>
                    <td className="sc-event">
                      {s.event}
                      <div className="sc-sub">{s.time} · {s.role}</div>
                    </td>
                    <td>{s.role}</td>
                    <td className="sc-name"><PrimaryCell primary={s.primary} /></td>
                    <td className="sc-standby"><StandbyCell standby={s.standby} /></td>
                    <td><Badge status={s.status} /></td>
                    <td className="sc-actioncell">{actionCell(s)}</td>
                  </tr>
                  <tr className="sc-log-row">
                    <td colSpan={8}>
                      <div className={`sc-logbox${logsOpen[s.id] ? " sc-open" : ""}`}>
                        <div className="sc-logbox-inner">
                          {(logs[s.id] || []).map((line, i) => (
                            <p key={i} className={line.cls || ""}>{line.text}</p>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
