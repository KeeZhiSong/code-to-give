-- Migration 006 — logistics partners
-- Run in the Supabase SQL editor. Safe to run more than once.
--
-- The third input to the Event Readiness Score, alongside headcount and task
-- completion: has the transport/warehouse/venue partner actually confirmed?
-- Deliberately minimal — a name and a confirmed flag — because at this scale
-- PTS is coordinating a handful of named contacts per event, not running a
-- partner directory.

create table if not exists logistics_partners (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  name        text not null,
  confirmed   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists logistics_partners_event_idx on logistics_partners (event_id);

alter table logistics_partners enable row level security;
