"use client";

// Shift coverage — who's on each shift, and who backs them up.
//
// Reads and writes go through /api/shifts, not a Supabase client in the
// browser. The service_role key stays on the server, and promoting a standby
// is decided there too, so the page can't nominate whoever it likes.

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";

const STATUS_RANK = { ok: 0, triggered: 1, covered: 2, open: 3 };

const STYLES = `
  /* Aliases onto the app palette (globals.css :root). This board shipped as a
     dark terminal with its own fonts pulled from Google at runtime — a third
     visual world, and the only dark screen in a console that gets used
     outdoors on a phone. The layout below is unchanged; only the values are. */
  .sc-root{
    --sc-bg:var(--bg); --panel:var(--card); --panel2:var(--sunken); --sc-line:var(--line);
    --amber:var(--accent-text); --amber-dim:var(--line-strong);
    --green:var(--yes); --red:var(--no); --teal:var(--yes);
    --grey:var(--muted); --text:var(--ink);
    background: var(--sc-bg);
    font-family: var(--font-sans); color:var(--text); padding:28px 16px 60px;
    min-height: 100vh;
  }
  .sc-root *{ box-sizing:border-box; }
  .sc-wrap{ max-width:1180px; margin:0 auto; }
  .sc-app{ background:var(--panel); border:1px solid var(--sc-line); border-radius:10px;
    box-shadow:0 1px 2px rgba(22,48,42,0.06); overflow:hidden; }
  .sc-titlebar{ display:flex; align-items:center; gap:8px; padding:10px 14px;
    background:var(--panel2); border-bottom:1px solid var(--sc-line); font-family:var(--font-mono); }
  .sc-dot{ width:10px; height:10px; border-radius:50%; background:var(--sc-line); }
  .sc-titlebar span.sc-path{ margin-left:10px; font-size:12px; color:var(--grey); }

  .sc-toolbar{ padding:16px 20px; border-bottom:1px solid var(--sc-line); display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; }
  .sc-toolbar h2{ margin:0 0 4px; font-size:19px; color:var(--text); font-weight:600; }
  .sc-toolbar p{ margin:0; font-size:13px; color:var(--grey); line-height:1.5; max-width:560px; }

  .sc-bulkbar{ display:flex; align-items:center; gap:10px; }
  .sc-bulkbar span.sc-count{ font-family:var(--font-mono); font-size:12px; color:var(--grey); }
  button.sc-bulk{ font-family:var(--font-mono); font-size:12px; background:transparent;
    border:1px solid var(--amber-dim); color:var(--amber); padding:8px 14px; border-radius:6px; cursor:pointer; transition:.12s; white-space:nowrap; }
  button.sc-bulk:hover:not(:disabled){ background:var(--accent-tint); border-color:var(--amber); }
  button.sc-bulk:disabled{ opacity:.3; cursor:not-allowed; border-color:var(--sc-line); color:var(--grey); }
  button.sc-bulk.sc-ghost{ border-color:var(--sc-line); color:var(--grey); }

  .sc-filterbar{
    display:flex; align-items:center; gap:10px; padding:14px 20px; border-bottom:1px solid var(--sc-line);
    flex-wrap:wrap; background: var(--panel2);
  }
  .sc-filterbar label{ font-family:var(--font-mono); font-size:12px; color:var(--grey); text-transform:uppercase; letter-spacing:0.5px; margin-right:2px; }
  .sc-filterbar select{
    font-family:var(--font-mono); font-size:12px; background:var(--panel); color:var(--text);
    border:1px solid var(--sc-line); border-radius:6px; padding:6px 8px; cursor:pointer; outline:none;
  }
  .sc-filterbar select:hover{ border-color: var(--amber-dim); }
  .sc-filtergroup{ display:flex; align-items:center; gap:6px; }
  button.sc-dirbtn{
    font-family:var(--font-mono); font-size:12px; background:var(--panel); border:1px solid var(--sc-line);
    color:var(--amber); border-radius:6px; padding:6px 9px; cursor:pointer;
  }
  button.sc-dirbtn:hover{ border-color:var(--amber-dim); }
  .sc-clearfilters{ font-family:var(--font-mono); font-size:12px; color:var(--amber-dim); cursor:pointer; margin-left:auto; }
  .sc-clearfilters:hover{ color:var(--amber); }

  .sc-legend{ display:flex; gap:16px; font-size:12px; color:var(--grey); flex-wrap:wrap; padding:12px 20px 0; }
  .sc-legend span{ display:inline-flex; align-items:center; gap:5px; }
  .sc-swatch{ width:8px; height:8px; border-radius:50%; display:inline-block; }

  .sc-tablewrap{ padding:16px 20px 22px; }
  .sc-table{ width:100%; border-collapse:collapse; font-size:13px; }
  .sc-table thead th{ text-align:left; font-family:var(--font-mono); font-size:12px; text-transform:uppercase;
    letter-spacing:0.6px; color:var(--grey); padding:8px 10px; border-bottom:1px solid var(--sc-line); user-select:none; }
  .sc-table thead th.sc-sortable{ cursor:pointer; }
  .sc-table thead th.sc-sortable:hover{ color:var(--amber); }
  .sc-table thead th .sc-arrow{ margin-left:4px; opacity:0.6; }
  .sc-table tbody td{ padding:10px; vertical-align:top; border-bottom:1px solid var(--sc-line); }
  tr.sc-shift-row:hover{ background:var(--panel2); }
  tr.sc-shift-row.sc-checked{ background:var(--accent-tint); }
  td.sc-event{ color:var(--text); font-weight:500; }
  td.sc-event .sc-sub{ color:var(--grey); font-weight:400; font-size:12px; }
  td.sc-date{ font-family:var(--font-mono); color:var(--grey); white-space:nowrap; }
  td.sc-name{ font-family:var(--font-mono); }
  td.sc-standby{ font-family:var(--font-mono); color:var(--grey); font-size:12px; }
  td.sc-standby .sc-who{ color:var(--text); }
  td.sc-standby .sc-arrow2{ color:var(--sc-line); margin:0 3px; }
  td.sc-check{ width:30px; }
  .sc-root input[type=checkbox]{ width:15px; height:15px; accent-color: var(--amber); cursor:pointer; }

  .sc-badge{ font-family:var(--font-mono); font-size:12px; padding:3px 9px; border-radius:10px;
    display:inline-block; border:1px solid transparent; white-space:nowrap; }
  .sc-badge.sc-ok{ color:var(--green); background:var(--yes-tint); border-color:var(--sc-line); }
  .sc-badge.sc-triggered{ color:var(--accent-ink); background:var(--accent-tint); border-color:var(--amber); animation:sc-pulse 1s ease-in-out infinite; }
  .sc-badge.sc-covered{ color:var(--teal); background:var(--yes-tint); border-color:var(--sc-line); }
  .sc-badge.sc-open{ color:var(--red); background:var(--no-tint); border-color:var(--red); font-weight:600; }
  @keyframes sc-pulse{ 0%,100%{opacity:1;} 50%{opacity:.5;} }

  .sc-actioncell{ text-align:right; white-space:nowrap; }
  button.sc-act{ font-family:var(--font-mono); font-size:12px; background:transparent;
    border:1px solid var(--sc-line); color:var(--amber); padding:6px 10px; border-radius:5px; cursor:pointer; transition:.12s; }
  button.sc-act:hover:not(:disabled){ border-color:var(--amber-dim); background:var(--accent-tint); }
  button.sc-act:disabled{ opacity:.35; cursor:not-allowed; }

  tr.sc-log-row td{ border-bottom:1px solid var(--sc-line); padding:0; }
  .sc-logbox{ font-family:var(--font-mono); font-size:12px; color:var(--grey);
    background:var(--panel2); padding:0 14px; max-height:0; overflow:hidden; transition:max-height .25s ease, padding .25s ease; }
  .sc-logbox.sc-open{ padding:10px 14px; max-height:260px; }
  .sc-logbox p{ margin:3px 0; animation:sc-rise .15s forwards; }
  .sc-logbox .sc-ok-line{ color:var(--green); }
  .sc-logbox .sc-warn-line{ color:var(--red); }
  @keyframes sc-rise{ from{opacity:0; transform:translateY(2px);} to{opacity:1; transform:translateY(0);} }

  .sc-empty-state{ text-align:center; padding:30px; color:var(--grey); font-family:var(--font-mono); font-size:13px; }
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

function StandbyCell({ standby }) {
  if (!standby || !standby.length) return <span style={{ color: "var(--grey)" }}>— queue empty —</span>;
  return standby.map((n, i) => (
    <React.Fragment key={n + i}>
      {i > 0 && <span className="sc-arrow2">→</span>}
      <span className="sc-who">{n}</span>
    </React.Fragment>
  ));
}

function PrimaryCell({ primary }) {
  return primary
    ? <span className="sc-who">{primary}</span>
    : <span style={{ color: "var(--red)" }}>— unassigned —</span>;
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
      return <button className="sc-act" disabled>Working…</button>;
    }
    if (s.status === "open") {
      return <span style={{ fontSize: 11, color: "var(--grey)" }}>needs organizer</span>;
    }
    if (s.primary) {
      return <button className="sc-act" onClick={() => simulateCancellation(s.id)}>Simulate cancellation</button>;
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
    <div className="sc-root">
      <style>{STYLES}</style>
      <div className="sc-wrap">
        <div className="sc-app">
          <div className="sc-titlebar">
            <div className="sc-dot" /><div className="sc-dot" /><div className="sc-dot" />
            <span className="sc-path">volunteer-ops — handover://coverage</span>
          </div>

          <div className="sc-toolbar">
            <div>
              <h2>Shift Coverage</h2>
              <p>Every shift has a primary volunteer and an ordered standby queue. If the primary cancels, the system auto-notifies the next standby in line — and keeps escalating if that person cancels too.</p>
            </div>
            <div className="sc-bulkbar">
              <span className="sc-count">{selected.size} selected</span>
              <button className="sc-bulk sc-ghost" onClick={handleResetAll}>Reload from DB</button>
              <button className="sc-bulk" disabled={selected.size === 0} onClick={handleBulkCancel}>
                Simulate selected cancellations
              </button>
            </div>
          </div>

          <div className="sc-filterbar">
            <div className="sc-filtergroup">
              <label>Event</label>
              <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
                <option value="all">All</option>
                {eventOptions.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
              </select>
            </div>
            <div className="sc-filtergroup">
              <label>Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="ok">Confirmed</option>
                <option value="triggered">Backup triggered</option>
                <option value="covered">Covered by backup</option>
                <option value="open">Unfilled</option>
              </select>
            </div>
            <div className="sc-filtergroup">
              <label>Sort by</label>
              <select value={sortField} onChange={(e) => { setSortField(e.target.value); }}>
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
            <span><span className="sc-swatch" style={{ background: "var(--green)" }} />confirmed</span>
            <span><span className="sc-swatch" style={{ background: "var(--amber)" }} />backup triggered</span>
            <span><span className="sc-swatch" style={{ background: "var(--teal)" }} />covered by backup</span>
            <span><span className="sc-swatch" style={{ background: "var(--red)" }} />unfilled</span>
          </div>

          <div className="sc-tablewrap">
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
                    <td colSpan={8} className="sc-empty-state" style={{ color: "var(--red)" }}>
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
                            {(logs[s.id] || []).map((line, i) => (
                              <p key={i} className={line.cls || ""}>{line.text}</p>
                            ))}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}