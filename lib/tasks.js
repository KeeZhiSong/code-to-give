// Tasks — the Unified Event Task Board. One Kanban per event so "what's
// outstanding" is visible in one place instead of scattered across chats.
//
// Backed by the Supabase `tasks` table (migration 005). No fallback mode:
// unlike events, tasks are new and never had a pre-database life, so it's
// fine to just require Supabase.

import { createClient } from "@supabase/supabase-js";

let client = null;

export function tasksConfigured() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function db() {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return client;
}

function unwrap(result, what) {
  if (result.error) throw new Error(`Supabase ${what} failed: ${result.error.message}`);
  return result.data;
}

export class TaskError extends Error {
  constructor(message) {
    super(message);
    this.name = "TaskError";
  }
}

const STATUSES = ["todo", "inprogress", "done"];

const trim = (v) => (typeof v === "string" ? v.trim() : v);

/** Every task for an event, grouped by column, ordered for display within it. */
export async function listTasks(eventId) {
  if (!tasksConfigured()) throw new TaskError("Tasks need Supabase.");
  const rows = unwrap(
    await db()
      .from("tasks")
      .select("*")
      .eq("event_id", eventId)
      .order("position", { ascending: true }),
    "list tasks"
  );
  return rows || [];
}

export async function createTask(eventId, input) {
  if (!tasksConfigured()) throw new TaskError("Tasks need Supabase.");
  const title = trim(input.title);
  if (!title) throw new TaskError("Task title is required.");

  const status = STATUSES.includes(input.status) ? input.status : "todo";

  // New cards land after whatever's already in that column.
  const siblings = unwrap(
    await db()
      .from("tasks")
      .select("position")
      .eq("event_id", eventId)
      .eq("status", status)
      .order("position", { ascending: false })
      .limit(1),
    "task position lookup"
  );
  const position = (siblings?.[0]?.position ?? -1) + 1;

  const row = {
    event_id: eventId,
    title,
    owner: trim(input.owner) || null,
    deadline: input.deadline || null,
    status,
    position,
  };

  return unwrap(await db().from("tasks").insert(row).select().single(), "create task");
}

/**
 * Update a task — moving columns (drag-and-drop), editing fields, or both.
 * `partial`: only the keys the caller sent are touched, so a drag that only
 * changes status/position can't silently blank the title.
 */
export async function updateTask(id, input) {
  if (!tasksConfigured()) throw new TaskError("Tasks need Supabase.");
  const data = { updated_at: new Date().toISOString() };

  if ("title" in input) {
    const title = trim(input.title);
    if (!title) throw new TaskError("Task title is required.");
    data.title = title;
  }
  if ("owner" in input) data.owner = trim(input.owner) || null;
  if ("deadline" in input) data.deadline = input.deadline || null;
  if ("status" in input) {
    if (!STATUSES.includes(input.status)) throw new TaskError(`Unknown status "${input.status}".`);
    data.status = input.status;
  }
  if ("position" in input) data.position = Number(input.position);

  return unwrap(
    await db().from("tasks").update(data).eq("id", id).select().single(),
    "update task"
  );
}

export async function deleteTask(id) {
  if (!tasksConfigured()) throw new TaskError("Tasks need Supabase.");
  unwrap(await db().from("tasks").delete().eq("id", id), "delete task");
}
