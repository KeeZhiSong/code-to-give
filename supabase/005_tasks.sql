-- Migration 005 — tasks table
-- Run in the Supabase SQL editor. Safe to run more than once.
--
-- The Unified Event Task Board: one Kanban per event so "what's outstanding"
-- lives in one place instead of six WhatsApp threads. Deliberately flat —
-- no assignee table, just a free-text owner — because the org is a handful
-- of volunteers coordinating by first name, not a user-account system.

create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  title       text not null,
  owner       text,
  deadline    date,
  status      text not null default 'todo',   -- todo | inprogress | done
  -- Fractional position within its column, so a drag-to-reorder can slot a
  -- card between two others without renumbering the whole column.
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tasks_event_idx on tasks (event_id);

alter table tasks enable row level security;
