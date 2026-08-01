"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const COLUMNS = [
  { status: "todo", label: "To do" },
  { status: "inprogress", label: "In progress" },
  { status: "done", label: "Done" },
];

const BLANK = { title: "", owner: "", deadline: "", status: "todo" };

function formatDeadline(value) {
  if (!value) return null;
  // Parsed as local midnight, not UTC — a bare "2026-08-05" shouldn't shift a
  // day depending on the browser's timezone.
  return new Date(`${value}T00:00:00`).toLocaleDateString([], { day: "numeric", month: "short" });
}

function daysUntil(value) {
  if (!value) return null;
  const ms = new Date(`${value}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

/**
 * Unified Event Task Board — a Kanban per event so "what's outstanding" is
 * visible in one place instead of scattered across chat threads.
 */
export default function TaskBoard({ eventId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(BLANK);
  const [adding, setAdding] = useState(false);
  const [dragOverCol, setDragOverCol] = useState("");

  const load = useCallback(() => {
    if (!eventId) return;
    fetch(`/api/events/${eventId}/tasks`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : (setError(""), setTasks(d.tasks))))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const byColumn = useMemo(() => {
    const grouped = { todo: [], inprogress: [], done: [] };
    for (const t of tasks) (grouped[t.status] || grouped.todo).push(t);
    for (const key of Object.keys(grouped)) grouped[key].sort((a, b) => a.position - b.position);
    return grouped;
  }, [tasks]);

  async function addTask(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) return setError(data.error);
      setTasks((prev) => [...prev, data.task]);
      setForm(BLANK);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function removeTask(id) {
    const prev = tasks;
    setTasks((cur) => cur.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setTasks(prev);
      }
    } catch (err) {
      setError(err.message);
      setTasks(prev);
    }
  }

  async function moveTask(id, status) {
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === status) return;

    const targetPosition = (byColumn[status].at(-1)?.position ?? -1) + 1;
    const prev = tasks;
    // Move it in the UI immediately — waiting on the round trip makes a drag
    // feel like it didn't register.
    setTasks((cur) =>
      cur.map((t) => (t.id === id ? { ...t, status, position: targetPosition } : t))
    );

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, position: targetPosition }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setTasks(prev);
      }
    } catch (err) {
      setError(err.message);
      setTasks(prev);
    }
  }

  if (loading) return <section className="pf-panel pf-empty">Loading task board…</section>;

  const counts = COLUMNS.map((c) => byColumn[c.status].length);

  return (
    <section className="pf-panel" aria-labelledby="board-title">
      <div className="pf-panel-head">
        <h3 id="board-title">Task Board</h3>
        <span className="pf-live-flag">
          {counts[0]} to do · {counts[1]} in progress · {counts[2]} done
        </span>
      </div>

      <form className="pf-add-task" onSubmit={addTask}>
        <label style={{ flex: 1 }}>
          Task
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Confirm truck booking with SG Trans Logistics"
            required
          />
        </label>
        <label>
          Owner
          <input
            type="text"
            value={form.owner}
            onChange={(e) => setForm({ ...form, owner: e.target.value })}
            placeholder="Nickson"
          />
        </label>
        <label>
          Deadline
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
        </label>
        <label>
          Column
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {COLUMNS.map((c) => (
              <option key={c.status} value={c.status}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button className="pf-btn pf-primary" type="submit" disabled={adding || !form.title.trim()}>
          {adding ? "Adding…" : "Add task"}
        </button>
      </form>

      {error && <div className="err">{error}</div>}

      <div className="pf-kanban">
        {COLUMNS.map((col) => (
          <div
            key={col.status}
            className={`pf-kanban-col${dragOverCol === col.status ? " pf-drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(col.status);
            }}
            onDragLeave={() => setDragOverCol((cur) => (cur === col.status ? "" : cur))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverCol("");
              const id = e.dataTransfer.getData("text/plain");
              if (id) moveTask(id, col.status);
            }}
          >
            <div className="pf-kanban-col-head">
              <h4>{col.label}</h4>
              <span className="pf-kanban-count">{byColumn[col.status].length}</span>
            </div>

            {byColumn[col.status].length === 0 ? (
              <p className="pf-empty">Nothing here.</p>
            ) : (
              <ul className="pf-kanban-list">
                {byColumn[col.status].map((task) => {
                  const days = daysUntil(task.deadline);
                  const soon = task.status !== "done" && days != null && days <= 3;
                  const chipClass = task.status === "done" ? "pf-done" : soon ? "pf-soon" : "";
                  return (
                    <li
                      key={task.id}
                      className="pf-task-card"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", task.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      <div className="pf-task-title">{task.title}</div>
                      <div className="pf-task-meta">
                        <span className="pf-owner-avatar" title={task.owner || "Unassigned"}>
                          {initials(task.owner)}
                        </span>
                        {task.deadline && (
                          <span className={`pf-deadline-chip pf-tabular ${chipClass}`}>
                            {formatDeadline(task.deadline)}
                          </span>
                        )}
                        <button
                          className="pf-task-delete"
                          type="button"
                          onClick={() => removeTask(task.id)}
                          aria-label={`Delete "${task.title}"`}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
