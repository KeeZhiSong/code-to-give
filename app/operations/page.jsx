"use client";
import React, { useState, useEffect } from "react";
import {
  Truck, Users, CheckCircle2, Circle,
  Calendar, MapPin, ArrowLeft, ClipboardList, Stamp,
  Activity, AlertTriangle, Boxes, Clock, Star, Minus, Plus
} from "lucide-react";

// Operations — on-the-day logistics: inventory, dispatches, open incidents.
//
// ORGANISER-FACING, like everything else on this site. It was originally
// framed as a dashboard "for incoming volunteers", and lived at /volunteer,
// which invited exactly the audience this tool doesn't serve: volunteers and
// beneficiaries reach us over WhatsApp, never through the console.
//
// NOTE: still running on seed data. Inventory and incidents have no tables
// behind them yet.

// ---------- palette / type tokens ----------
// Shares the project-wide system in DESIGN.md — see app/globals.css for the
// canonical values. kraft/kraftDark/stamp used to be a second and third
// accent color; consolidated to C.teal (the One Accent Rule). C.error is
// kept separate for real error states, which C.stamp used to also cover —
// that conflation meant "error" and "decorative accent" were the same color.
const C = {
  paper: "#FAF7F0",
  paperDark: "#EFE8D6",
  ink: "#0E2A3B",
  inkSoft: "#56707D",
  kraft: "#1C6B5E",
  kraftDark: "#1C6B5E",
  teal: "#1C6B5E",
  tealDark: "#175A4F",
  tealLight: "#E1EDEA",
  stamp: "#1C6B5E",
  error: "#8B4B3E",
  line: "#E2DDCF",
  white: "#FFFFFA",
};

// Fonts come from next/font/google in app/layout.jsx, exposed as
// --font-display/--font-body/--font-mono on <html> — no external @import.
const FONTS = ``;

const SEED_INVENTORY = [
  { id: "inv-relief-packs", name: "Relief goods packs", type: "Critical supply", qty: 240, checkedOut: 0, unit: "packs", low: 40 },
  { id: "inv-sacks", name: "Packing sacks & boxes", type: "Critical supply", qty: 500, checkedOut: 0, unit: "pcs", low: 80 },
  { id: "inv-water", name: "Bottled water", type: "Incoming donation", qty: 300, checkedOut: 0, unit: "bottles", low: 60 },
  { id: "inv-truck", name: "Delivery truck", type: "Equipment", qty: 2, checkedOut: 1, unit: "units", low: 1 },
  { id: "inv-tablet", name: "Registration tablets", type: "Equipment", qty: 4, checkedOut: 2, unit: "units", low: 1 },
  { id: "inv-firstaid", name: "First aid kits", type: "Equipment", qty: 6, checkedOut: 1, unit: "kits", low: 2 },
];

const SEED_ROSTER = [
  { id: "vol-maria", name: "Maria Santos", role: "Team lead", shift: "Today · 7:00–12:00", eventName: "GIFTIK Distribution Drive", teamLead: true, status: "active" },
  { id: "vol-jun", name: "Jun Dela Cruz", role: "Bundle carrier", shift: "Today · 7:00–12:00", eventName: "GIFTIK Distribution Drive", teamLead: false, status: "active" },
  { id: "vol-ana", name: "Ana Reyes", role: "Registration desk", shift: "Tomorrow · 8:00–13:00", eventName: "Food To Serve", teamLead: false, status: "upcoming" },
  { id: "vol-paolo", name: "Paolo Ramos", role: "Team lead", shift: "Sat · 8:00–14:00", eventName: "Beach Cleanup", teamLead: true, status: "upcoming" },
];

const SEED_INCIDENTS = [
  { id: "inc-truck-delay", title: "Delivery truck delayed at checkpoint", severity: "Bottleneck", eventName: "GIFTIK Distribution Drive", status: "open" },
  { id: "inc-sacks-low", title: "Running low on packing sacks", severity: "Supply shortage", eventName: "GIFTIK Distribution Drive", status: "open" },
];

const SEED_FEED = [
  { id: "feed-1", text: "Delivery truck #2 departed warehouse en route to Barangay Covered Court", ts: Date.now() - 1000 * 60 * 42 },
  { id: "feed-2", text: "Registration tablets checked out for GIFTIK Distribution Drive", ts: Date.now() - 1000 * 60 * 25 },
  { id: "feed-3", text: "Route confirmed: Warehouse → Barangay Hall → Distribution site", ts: Date.now() - 1000 * 60 * 10 },
];

export default function VolunteerDashboard() {
  const [view, setView] = useState("dashboard"); // dashboard | detail
  const [activeEventId, setActiveEventId] = useState(null);
  const [inventory, setInventory] = useState(SEED_INVENTORY);
  const [roster, setRoster] = useState(SEED_ROSTER);
  const [incidents, setIncidents] = useState(SEED_INCIDENTS);
  const [feed, setFeed] = useState(SEED_FEED);
  const [incidentForm, setIncidentForm] = useState({ title: "", severity: "Bottleneck" });
  const [showIncidentForm, setShowIncidentForm] = useState(false);

  // Mock events list for volunteer view progress tracking
  const [events, setEvents] = useState([
    {
      id: "ev-1",
      templateName: "GIFTIK Distribution Drive",
      date: "2026-08-05",
      venue: "Barangay Covered Court",
      tasks: [
        { id: "t1", label: "Confirm recipient list with coordinator", done: true },
        { id: "t2", label: "Pack relief goods into bundles", done: false },
      ],
      logisticsPartners: [
        { id: "lp1", label: "Trucking partner — goods transport", confirmed: true },
      ],
      volunteerRoles: [
        { id: "vr1", label: "Registration desk", filled: true },
      ],
    },
  ]);

  const activeEvent = events.find((e) => e.id === activeEventId);
  const upcomingEvents = [...events].sort((a, b) => (a.date > b.date ? 1 : -1));

  // Key metrics
  const totalTasksDone = events.reduce((sum, e) => sum + e.tasks.filter((x) => x.done).length, 0);
  const totalTasksAll = events.reduce((sum, e) => sum + e.tasks.length, 0);
  const completionRate = totalTasksAll ? Math.round((totalTasksDone / totalTasksAll) * 100) : 0;
  const pendingDispatches = events.reduce(
    (sum, e) => sum + e.logisticsPartners.filter((x) => !x.confirmed).length,
    0
  );
  const openIncidents = incidents.filter((i) => i.status === "open");

  function timeAgo(ts) {
    const mins = Math.max(1, Math.round((Date.now() - ts) / 60000));
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    return `${hrs}h ago`;
  }

  function pushFeed(text) {
    setFeed((prev) => [{ id: Math.random().toString(36).slice(2, 10), text, ts: Date.now() }, ...prev].slice(0, 20));
  }

  function adjustCheckout(id, delta) {
    setInventory((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next = Math.min(it.qty, Math.max(0, it.checkedOut + delta));
        if (next !== it.checkedOut) {
          pushFeed(`${it.name} — ${delta > 0 ? "checked out" : "checked in"} (${next}/${it.qty} out)`);
        }
        return { ...it, checkedOut: next };
      })
    );
  }

  function addIncident() {
    if (!incidentForm.title.trim()) return;
    const inc = {
      id: Math.random().toString(36).slice(2, 10),
      title: incidentForm.title.trim(),
      severity: incidentForm.severity,
      eventName: activeEvent ? activeEvent.templateName : "General Operations",
      status: "open"
    };
    setIncidents((prev) => [inc, ...prev]);
    pushFeed(`Incident logged: ${inc.title}`);
    setIncidentForm({ title: "", severity: "Bottleneck" });
    setShowIncidentForm(false);
  }

  function resolveIncident(id) {
    setIncidents((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (i.status === "open") pushFeed(`Resolved: ${i.title}`);
        return { ...i, status: i.status === "open" ? "resolved" : "open" };
      })
    );
  }

  function toggleItem(section, itemId) {
    const sectionLabel = section === "tasks" ? "Task" : section === "logisticsPartners" ? "Logistics partner" : "Volunteer role";
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== activeEventId) return e;
        const key = section === "tasks" ? "done" : section === "logisticsPartners" ? "confirmed" : "filled";
        const item = e[section].find((it) => it.id === itemId);
        if (item) {
          const willBeDone = !item[key];
          pushFeed(`${sectionLabel} ${willBeDone ? "completed" : "reopened"} — ${item.label} (${e.templateName})`);
        }
        return {
          ...e,
          [section]: e[section].map((it) => (it.id === itemId ? { ...it, [key]: !it[key] } : it)),
        };
      })
    );
  }

  const eventProgress = (ev) => {
    const tasksDone = ev.tasks.filter((x) => x.done).length;
    const partnersDone = ev.logisticsPartners.filter((x) => x.confirmed).length;
    const rolesDone = ev.volunteerRoles.filter((x) => x.filled).length;
    const totalDone = tasksDone + partnersDone + rolesDone;
    const totalItems = ev.tasks.length + ev.logisticsPartners.length + ev.volunteerRoles.length;
    return {
      tasksDone, partnersDone, rolesDone, totalDone, totalItems,
      percent: totalItems ? Math.round((totalDone / totalItems) * 100) : 0,
    };
  };

  const StampBadge = ({ text = "DONE", rotate = -8 }) => (
    <div
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        border: `2px solid ${C.stamp}`,
        color: C.stamp,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: 2,
        padding: "3px 10px",
        borderRadius: 4,
        transform: `rotate(${rotate}deg)`,
        opacity: 0.75,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {text}
    </div>
  );

  return (
    <div style={{ background: C.paper, minHeight: "100vh", fontFamily: "var(--font-body)", color: C.ink }}>
      <style>{FONTS}</style>

      {/* Header */}
      <div style={{ background: C.ink, color: C.paper, padding: "22px 28px", borderBottom: `6px solid ${C.kraft}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ClipboardList size={22} color={C.kraft} />
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: 1.5, textTransform: "uppercase" }}>
                Volunteer Operations Dashboard
              </div>
            </div>
            <div style={{ fontSize: 13, color: "rgba(250,247,240,0.65)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
              Check the progress of incoming drives, manage inventory &amp; review live operation logs
            </div>
          </div>
        </div>
      </div>

      {view === "dashboard" && (
        <div style={{ padding: "28px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, textTransform: "uppercase", letterSpacing: 1, marginBottom: 18 }}>
            Current logistics overview
          </div>

          {/* Key tracking metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
            <StatCard label="Completion rate" value={`${completionRate}%`} sub="daily logistics tasks fulfilled" color={C.teal} icon={<CheckCircle2 size={16} />} C={C} />
            <StatCard label="Pending dispatches" value={pendingDispatches} sub="awaiting transport/assignment" color={C.stamp} icon={<Truck size={16} />} C={C} />
            <StatCard label="Open incidents" value={openIncidents.length} sub="unresolved bottlenecks/delays" color={C.kraftDark} icon={<AlertTriangle size={16} />} C={C} />
          </div>

          {/* Live operations feed */}
          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, marginBottom: 24, overflow: "hidden" }}>
            <div style={{ background: C.ink, color: C.paper, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13 }}>
              <Activity size={14} color={C.kraft} /> Live operations feed
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {feed.length === 0 && (
                <div style={{ padding: 14, fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>No activity yet</div>
              )}
              {feed.map((f) => (
                <div key={f.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 14px", borderBottom: `1px solid ${C.paperDark}`, fontSize: 13 }}>
                  <span>{f.text}</span>
                  <span style={{ color: C.inkSoft, fontFamily: "var(--font-mono)", fontSize: 11, whiteSpace: "nowrap" }}>{timeAgo(f.ts)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Inventory & roster */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 24 }}>
            <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ background: C.tealLight, color: C.tealDark, padding: "10px 14px", display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13 }}>
                <Boxes size={14} /> Inventory &amp; asset tracking
              </div>
              <div>
                {inventory.map((it) => {
                  const available = it.qty - it.checkedOut;
                  const isLow = available <= it.low;
                  return (
                    <div key={it.id} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.paperDark}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</span>
                        <span style={{ fontSize: 11, color: isLow ? C.stamp : C.inkSoft, fontFamily: "var(--font-mono)" }}>
                          {isLow ? "LOW · " : ""}{available}/{it.qty} {it.unit}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: C.inkSoft }}>{it.type}{it.checkedOut > 0 ? ` · ${it.checkedOut} checked out` : ""}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => adjustCheckout(it.id, -1)} disabled={it.checkedOut <= 0} title="Check in"
                            style={{ border: `1px solid ${C.line}`, background: "transparent", borderRadius: 5, padding: "3px 6px", cursor: it.checkedOut <= 0 ? "not-allowed" : "pointer", color: C.inkSoft }}>
                            <Minus size={12} />
                          </button>
                          <button onClick={() => adjustCheckout(it.id, 1)} disabled={it.checkedOut >= it.qty} title="Check out"
                            style={{ border: `1px solid ${C.line}`, background: "transparent", borderRadius: 5, padding: "3px 6px", cursor: it.checkedOut >= it.qty ? "not-allowed" : "pointer", color: C.inkSoft }}>
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ background: C.tealLight, color: C.tealDark, padding: "10px 14px", display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13 }}>
                <Users size={14} /> Volunteer shift roster
              </div>
              <div>
                {roster.map((v) => (
                  <div key={v.id} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.paperDark}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                        {v.teamLead && <Star size={12} color={C.kraftDark} fill={C.kraftDark} />}
                        {v.name}
                      </div>
                      <div style={{ fontSize: 11, color: C.inkSoft }}>{v.role} · {v.eventName}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: C.inkSoft, display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                        <Clock size={11} /> {v.shift}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
                        color: v.status === "active" ? C.teal : C.inkSoft,
                      }}>
                        {v.status === "active" ? "Active now" : "Upcoming"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Incident logs */}
          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden", marginBottom: 24 }}>
            <div style={{ background: C.ink, color: C.paper, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13 }}>
                <AlertTriangle size={14} color={C.stamp} /> Incident logs
              </div>
              <button
                onClick={() => setShowIncidentForm((s) => !s)}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: `1px solid ${C.kraft}`, color: C.paper, borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
              >
                <Plus size={12} /> Log incident
              </button>
            </div>
            {showIncidentForm && (
              <div style={{ padding: 14, borderBottom: `1px solid ${C.paperDark}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  placeholder="What happened?"
                  value={incidentForm.title}
                  onChange={(e) => setIncidentForm((f) => ({ ...f, title: e.target.value }))}
                  style={{ flex: 1, minWidth: 180, padding: "7px 10px", border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 13 }}
                />
                <select
                  value={incidentForm.severity}
                  onChange={(e) => setIncidentForm((f) => ({ ...f, severity: e.target.value }))}
                  style={{ padding: "7px 10px", border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 13, background: C.white }}
                >
                  <option>Bottleneck</option>
                  <option>Delivery delay</option>
                  <option>Supply shortage</option>
                  <option>Other</option>
                </select>
                <button onClick={addIncident} style={{ background: C.stamp, color: C.white, border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Log
                </button>
              </div>
            )}
            {incidents.length === 0 && (
              <div style={{ padding: 14, fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>No incidents logged</div>
            )}
            {incidents.map((inc) => (
              <div key={inc.id} onClick={() => resolveIncident(inc.id)} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.paperDark}`, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, textDecoration: inc.status === "resolved" ? "line-through" : "none", color: inc.status === "resolved" ? C.inkSoft : C.ink }}>
                    {inc.title}
                  </div>
                  <div style={{ fontSize: 11, color: C.inkSoft }}>{inc.severity}{inc.eventName ? ` · ${inc.eventName}` : ""}</div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, padding: "3px 8px", borderRadius: 4,
                  background: inc.status === "open" ? "rgba(139,75,62,0.12)" : C.tealLight,
                  color: inc.status === "open" ? C.error : C.tealDark,
                }}>
                  {inc.status === "open" ? "Open" : "Resolved"}
                </span>
              </div>
            ))}
          </div>

          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, color: C.inkSoft }}>
            Active events progress
          </div>

          {upcomingEvents.length === 0 && (
            <div style={{ background: C.white, border: `1px dashed ${C.line}`, borderRadius: 8, padding: 28, textAlign: "center", color: C.inkSoft }}>
              Nothing to check yet.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {upcomingEvents.map((ev) => {
              const p = eventProgress(ev);
              const complete = p.totalItems > 0 && p.totalDone === p.totalItems;
              return (
                <div
                  key={ev.id}
                  onClick={() => { setActiveEventId(ev.id); setView("detail"); }}
                  style={{
                    background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, padding: 16, cursor: "pointer",
                    position: "relative",
                  }}
                >
                  {complete && <StampBadge text="DONE" rotate={-8} />}
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                    {ev.templateName}
                  </div>
                  <div style={{ display: "flex", gap: 14, fontSize: 12, color: C.inkSoft, marginBottom: 12 }}>
                    <span><Calendar size={12} style={{ verticalAlign: -1, marginRight: 3 }} />{ev.date || "undated"}</span>
                    <span><MapPin size={12} style={{ verticalAlign: -1, marginRight: 3 }} />{ev.venue || "no venue"}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>
                    <span>Overall progress</span>
                    <span style={{ fontFamily: "var(--font-mono)" }}>{p.percent}%</span>
                  </div>
                  <ProgressBar percent={p.percent} color={C.teal} C={C} />

                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    <MiniBar label="Tasks" icon={<ClipboardList size={12} />} done={p.tasksDone} total={ev.tasks.length} color={C.stamp} C={C} />
                    <MiniBar label="Logistics partners" icon={<Truck size={12} />} done={p.partnersDone} total={ev.logisticsPartners.length} color={C.teal} C={C} />
                    <MiniBar label="Volunteer roles" icon={<Users size={12} />} done={p.rolesDone} total={ev.volunteerRoles.length} color={C.kraftDark} C={C} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "detail" && activeEvent && (
        <div style={{ padding: 28 }}>
          <button
            onClick={() => setView("dashboard")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.teal, cursor: "pointer", marginBottom: 16, fontSize: 13, padding: 0 }}
          >
            <ArrowLeft size={15} /> Back to dashboard
          </button>

          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 10, padding: 22, position: "relative", marginBottom: 20 }}>
            <StampBadge />
            <div style={{ fontSize: 11, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 1, fontFamily: "var(--font-mono)" }}>
              Event Operation Details
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, margin: "4px 0 8px" }}>
              {activeEvent.templateName}
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 13, color: C.inkSoft }}>
              <span><Calendar size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{activeEvent.date}</span>
              <span><MapPin size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{activeEvent.venue}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
            <ChecklistCard
              title="Task list" icon={<ClipboardList size={15} />}
              items={activeEvent.tasks} doneKey="done"
              onToggle={(id) => toggleItem("tasks", id)}
              C={C}
            />
            <ChecklistCard
              title="Logistics-partner checklist" icon={<Truck size={15} />}
              items={activeEvent.logisticsPartners} doneKey="confirmed"
              onToggle={(id) => toggleItem("logisticsPartners", id)}
              C={C}
            />
            <ChecklistCard
              title="Volunteer roles" icon={<Users size={15} />}
              items={activeEvent.volunteerRoles} doneKey="filled"
              onToggle={(id) => toggleItem("volunteerRoles", id)}
              C={C}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color, icon, C }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, padding: 16, borderTop: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.inkSoft, marginBottom: 6 }}>
        <span style={{ color }}>{icon}</span> {label}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, color: C.ink }}>{value}</div>
      <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function ProgressBar({ percent, color, C }) {
  return (
    <div style={{ height: 8, borderRadius: 999, background: C.paperDark, overflow: "hidden" }}>
      <div style={{ height: "100%", width: "100%", transform: `scaleX(${percent / 100})`, transformOrigin: "left", background: color, borderRadius: 999, transition: "transform 0.2s" }} />
    </div>
  );
}

function MiniBar({ label, icon, done, total, color, C }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: C.inkSoft, marginBottom: 3 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{icon} {label}</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>{done}/{total}</span>
      </div>
      <ProgressBar percent={percent} color={color} C={C} />
    </div>
  );
}

function ChecklistCard({ title, icon, items, doneKey, onToggle, C }) {
  const doneCount = items.filter((i) => i[doneKey]).length;
  return (
    <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ background: C.tealLight, color: C.tealDark, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 13 }}>
          {icon} {title}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{doneCount}/{items.length}</div>
      </div>
      <div style={{ padding: "6px 0" }}>
        {items.length === 0 && (
          <div style={{ padding: "12px 14px", fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>Nothing listed</div>
        )}
        {items.map((it) => (
          <div
            key={it.id}
            onClick={() => onToggle(it.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", cursor: "pointer",
              fontSize: 13, borderBottom: `1px solid ${C.paperDark}`,
              color: it[doneKey] ? C.inkSoft : C.ink,
              textDecoration: it[doneKey] ? "line-through" : "none",
            }}
          >
            {it[doneKey] ? <CheckCircle2 size={16} color={C.teal} /> : <Circle size={16} color={C.line} />}
            {it.label}
          </div>
        ))}
      </div>
    </div>
  );
}