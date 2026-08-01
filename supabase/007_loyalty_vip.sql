-- Migration 007 — Volunteer Loyalty Programme + Beneficiary VIP Pass
-- Run in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to run more than once.
--
-- Why a join-table log rather than more _text[] columns: `events_attended`
-- (migration 003) and `courses` (migration 004) can say THAT someone showed
-- up, not WHEN, at WHICH event, or worth how many points — exactly the gap
-- Girija's brainstorm note describes ("Excel does not know they had
-- volunteered with us in the past"). Volunteers and beneficiaries get
-- separate log tables, mirroring why migration 004 made them separate tables
-- in the first place: different shape, different programme.
--
-- Points live on the EVENT, not invented per log row, and are snapshotted
-- onto the log row at attendance time — so changing an event's point value
-- later doesn't retroactively rescore everyone who already earned it. Same
-- reasoning migration 003 gives for why a credit is "a decision, not an
-- observation."
--
-- loyalty_points / loyalty_tier / vip_status are CACHED on the person row,
-- recomputed by the app (lib/loyalty.js) every time an attendance is logged.
-- Beneficiaries specifically need this cached rather than computed-on-read:
-- VIP status gets checked at the door — a GIFTIK queue running into the
-- hundreds — not from a dashboard with time to spare for a join.

alter table events
  add column if not exists points_value int not null default 1;

-- ─── Volunteer Loyalty Programme ─────────────────────────────────────────────
create table if not exists volunteer_event_log (
  id           uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  event_id     uuid not null references events(id) on delete cascade,
  role         text,
  hours        numeric,
  points       int not null default 0,
  attended_at  timestamptz not null default now(),
  -- Marking the same person attended the same event twice must never double
  -- their points — this is the upsert (ignoreDuplicates) target in
  -- lib/loyalty.js, which is what makes "mark attended" idempotent.
  unique (volunteer_id, event_id)
);

create index if not exists volunteer_event_log_volunteer_idx
  on volunteer_event_log (volunteer_id);

alter table volunteers
  add column if not exists loyalty_points int not null default 0,
  -- Nullable on purpose: no volunteer tier ladder has been defined yet (see
  -- lib/loyalty.js). Points accumulate now; a tier name gets written here
  -- once thresholds exist.
  add column if not exists loyalty_tier   text;

-- ─── Beneficiary VIP Pass ─────────────────────────────────────────────────────
create table if not exists beneficiary_activity_log (
  id             uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references beneficiaries(id) on delete cascade,
  event_id       uuid not null references events(id) on delete cascade,
  points         int not null default 0,
  attended_at    timestamptz not null default now(),
  unique (beneficiary_id, event_id)
);

create index if not exists beneficiary_activity_log_beneficiary_idx
  on beneficiary_activity_log (beneficiary_id);

alter table beneficiaries
  add column if not exists loyalty_points int not null default 0,
  -- VIP PASS: true once attendance count crosses VIP_THRESHOLD_ATTENDANCES
  -- (lib/config.js). Flipped by the app, checked at the door.
  add column if not exists vip_status     boolean not null default false;

-- RLS on, no policies: server-side service_role bypasses it, a leaked anon
-- key reads nothing — same model as every other table in this schema.
alter table volunteer_event_log      enable row level security;
alter table beneficiary_activity_log enable row level security;
