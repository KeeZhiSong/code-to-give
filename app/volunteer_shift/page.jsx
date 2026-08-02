"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const STATUS_RANK = { ok: 0, triggered: 1, covered: 2, open: 3 };

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

  .sc-root{
    --bg:#0a0c0a; --panel:#101310; --panel2:#0d0f0c; --line:#24291f;
    --amber:#ffb454; --amber-dim:#a9793a;
    --green:#8fd47a; --red:#ff6b6b; --teal:#7fd6d6; --grey:#6b7268; --text:#e9e6dd;
    background: radial-gradient(ellipse at top, #12140f 0%, var(--bg) 60%);
    font-family:'IBM Plex Sans', sans-serif; color:var(--text); padding:28px 16px 60px;
    min-height: 100vh;
  }
  .sc-root *{ box-sizing:border-box; }
  .sc-wrap{ max-width:1180px; margin:0 auto; }
  .sc-app{ background:var(--panel); border:1px solid var(--line); border-radius:10px;
    box-shadow:0 20px 60px -20px rgba(0,0,0,0.8); overflow:hidden; }
  .sc-titlebar{ display:flex; align-items:center; gap:8px; padding:10px 14px;
    background:var(--panel2); border-bottom:1px solid var(--line); font-family:'IBM Plex Mono',monospace; }
  .sc-dot{ width:10px; height:10px; border-radius:50%; background:#2a2e26; }
  .sc-titlebar span.sc-path{ margin-left:10px; font-size:12px; color:var(--grey); }

  .sc-toolbar{ padding:16px 20px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; }
  .sc-toolbar h2{ margin:0 0 4px; font-size:16px; color:#fff; font-weight:600; }
  .sc-toolbar p{ margin:0; font-size:12.5px; color:var(--grey); line-height:1.5; max-width:560px; }

  .sc-bulkbar{ display:flex; align-items:center; gap:10px; }
  .sc-bulkbar span.sc-count{ font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:var(--grey); }
  button.sc-bulk{ font-family:'IBM Plex Mono',monospace; font-size:11.5px; background:transparent;
    border:1px solid var(--amber-dim); color:var(--amber); padding:8px 14px; border-radius:6px; cursor:pointer; transition:.12s; white-space:nowrap; }
  button.sc-bulk:hover:not(:disabled){ background:rgba(255,180,84,0.08); border-color:var(--amber); }
  button.sc-bulk:disabled{ opacity:.3; cursor:not-allowed; border-color:var(--line); color:var(--grey); }
  button.sc-bulk.sc-ghost{ border-color:var(--line); color:var(--grey); }

  .sc-filterbar{
    display:flex; align-items:center; gap:10px; padding:14px 20px; border-bottom:1px solid var(--line);
    flex-wrap:wrap; background: var(--panel2);
  }
  .sc-filterbar label{ font-family:'IBM Plex Mono',monospace; font-size:10.5px; color:var(--grey); text-transform:uppercase; letter-spacing:0.5px; margin-right:2px; }
  .sc-filterbar select{
    font-family:'IBM Plex Mono',monospace; font-size:12px; background:var(--panel); color:var(--text);
    border:1px solid var(--line); border-radius:6px; padding:6px 8px; cursor:pointer; outline:none;
  }
  .sc-filterbar select:hover{ border-color: var(--amber-dim); }
  .sc-filtergroup{ display:flex; align-items:center; gap:6px; }
  button.sc-dirbtn{
    font-family:'IBM Plex Mono',monospace; font-size:12px; background:var(--panel); border:1px solid var(--line);
    color:var(--amber); border-radius:6px; padding:6px 9px; cursor:pointer;
  }
  button.sc-dirbtn:hover{ border-color:var(--amber-dim); }
  .sc-clearfilters{ font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--amber-dim); cursor:pointer; margin-left:auto; }
  .sc-clearfilters:hover{ color:var(--amber); }

  .sc-legend{ display:flex; gap:16px; font-size:11px; color:var(--grey); flex-wrap:wrap; padding:12px 20px 0; }
  .sc-legend span{ display:inline-flex; align-items:center; gap:5px; }
  .sc-swatch{ width:8px; height:8px; border-radius:50%; display:inline-block; }

  .sc-tablewrap{ padding:16px 20px 22px; }
  .sc-table{ width:100%; border-collapse:collapse; font-size:13px; }
  .sc-table thead th{ text-align:left; font-family:'IBM Plex Mono',monospace; font-size:10.5px; text-transform:uppercase;
    letter-spacing:0.6px; color:var(--grey); padding:8px 10px; border-bottom:1px solid var(--line); user-select:none; }
  .sc-table thead th.sc-sortable{ cursor:pointer; }
  .sc-table thead th.sc-sortable:hover{ color:var(--amber); }
  .sc-table thead th .sc-arrow{ margin-left:4px; opacity:0.6; }
  .sc-table tbody td{ padding:10px; vertical-align:top; border-bottom:1px solid #1a1d15; }
  tr.sc-shift-row:hover{ background:rgba(255,255,255,0.02); }
  tr.sc-shift-row.sc-checked{ background:rgba(255,180,84,0.04); }
  td.sc-event{ color:#fff; font-weight:500; }
  td.sc-event .sc-sub{ color:var(--grey); font-weight:400; font-size:11px; }
  td.sc-date{ font-family:'IBM Plex Mono',monospace; color:var(--grey); white-space:nowrap; }
  td.sc-name{ font-family:'IBM Plex Mono',monospace; }
  td.sc-standby{ font-family:'IBM Plex Mono',monospace; color:var(--grey); font-size:12px; }
  td.sc-standby .sc-who{ color:var(--text); }
  td.sc-standby .sc-arrow2{ color:var(--line); margin:0 3px; }
  td.sc-check{ width:30px; }
  .sc-root input[type=checkbox]{ width:15px; height:15px; accent-color: var(--amber); cursor:pointer; }

  .sc-badge{ font-family:'IBM Plex Mono',monospace; font-size:10.5px; padding:3px 9px; border-radius:10px;
    display:inline-block; border:1px solid transparent; white-space:nowrap; }
  .sc-badge.sc-ok{ color:var(--green); background:rgba(143,212,122,0.1); border-color:rgba(143,212,122,0.3); }
  .sc-badge.sc-triggered{ color:var(--amber); background:rgba(255,180,84,0.12); border-color:rgba(255,180,84,0.4); animation:sc-pulse 1s ease-in-out infinite; }
  .sc-badge.sc-covered{ color:var(--teal); background:rgba(127,214,214,0.1); border-color:rgba(127,214,214,0.35); }
  .sc-badge.sc-open{ color:var(--red); background:rgba(255,107,107,0.14); border-color:rgba(255,107,107,0.4); font-weight:600; }
  @keyframes sc-pulse{ 0%,100%{opacity:1;} 50%{opacity:.5;} }

  .sc-actioncell{ text-align:right; white-space:nowrap; }
  button.sc-act{ font-family:'IBM Plex Mono',monospace; font-size:11px; background:transparent;
    border:1px solid var(--line); color:var(--amber); padding:6px 10px; border-radius:5px; cursor:pointer; transition:.12s; }
  button.sc-act:hover:not(:disabled){ border-color:var(--amber-dim); background:rgba(255,180,84,0.06); }
  button.sc-act:disabled{ opacity:.35; cursor:not-allowed; }

  tr.sc-log-row td{ border-bottom:1px solid #1a1d15; padding:0; }
  .sc-logbox{ font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:var(--grey);
    background:var(--panel2); padding:0 14px; max-height:0; overflow:hidden; transition:max-height .25s ease, padding .25s ease; }
  .sc-logbox.sc-open{ padding:10px 14px; max-height:260px; }
  .sc-logbox p{ margin:3px 0; animation:sc-rise .15s forwards; }
  .sc-logbox .sc-ok-line{ color:var(--green); }
  .sc-logbox .sc-warn-line{ color:var(--red); }
  @keyframes sc-rise{ from{opacity:0; transform:translateY(2px);} to{opacity:1; transform:translateY(0);} }

  .sc-empty-state{ text-align:center; padding:30px; color:var(--grey); font-family:'IBM Plex Mono',monospace; font-size:12.5px; }
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

  // 1. Fetch live shifts from Supabase
  const fetchShifts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('shifts').select('*').order('date', { ascending: true });
    if (error) {
      console.error("Error fetching shifts:", error);
    } else {
      // Map Supabase snake_case columns to app format
      const formatted = data.map(s => ({
        ...s,
        primary: s.primary_volunteer
      }));
      setShifts(formatted);
    }
    setLoading(false);
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

  // 2. Perform cancellation and write update directly to Supabase
  const simulateCancellation = useCallback(async (id) => {
    const s = shiftsRef.current.find((x) => x.id === id);
    if (!s || !s.primary) return;

    setLogsOpen((prev) => ({ ...prev, [id]: true }));
    setWorking((prev) => ({ ...prev, [id]: true }));
    const cancelledName = s.primary;
    const standbyQueue = s.standby || [];

    await delay(100);
    appendLog(id, `✕ ${cancelledName} cancelled — shift now unstaffed`, null);

    if (standbyQueue.length) {
      setShifts((prev) => prev.map((x) => (x.id === id ? { ...x, status: "triggered" } : x)));
      await delay(500);
      const next = standbyQueue[0];
      appendLog(id, `→ system auto-notifying next in queue: ${next}...`, null);
      await delay(700);
      appendLog(id, `✓ ${next} confirmed — accepting shift`, "sc-ok-line");

      const remaining = standbyQueue.slice(1);

      // --- PERSIST TO SUPABASE ---
      await supabase
        .from('shifts')
        .update({ primary_volunteer: next, standby: remaining, status: 'covered' })
        .eq('id', id);

      setShifts((prev) => prev.map((x) => (x.id === id ? { ...x, primary: next, standby: remaining, status: "covered" } : x)));
      setWorking((prev) => ({ ...prev, [id]: false }));
      await delay(400);
      if (remaining.length) {
        appendLog(id, `→ shift reassigned in DB. ${next} is now primary. ${remaining.length} more standby${remaining.length > 1 ? "s" : ""} still on call.`, null);
      } else {
        appendLog(id, `→ shift reassigned in DB. ${next} is now primary. Standby queue is now empty.`, null);
      }
    } else {
      // --- PERSIST UNFILLED TO SUPABASE ---
      await supabase
        .from('shifts')
        .update({ primary_volunteer: null, status: 'open' })
        .eq('id', id);

      setShifts((prev) => prev.map((x) => (x.id === id ? { ...x, primary: null, status: "open" } : x)));
      setWorking((prev) => ({ ...prev, [id]: false }));
      await delay(500);
      appendLog(id, `⚠ standby queue exhausted — shift is unfilled`, "sc-warn-line");
      await delay(400);
      appendLog(id, `→ organizer notified to source emergency coverage`, null);
    }
  }, [appendLog]);

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
                {loading ? (
                  <tr><td colSpan={8} className="sc-empty-state">Loading shifts from Supabase...</td></tr>
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