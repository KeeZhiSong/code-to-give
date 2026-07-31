-- Migration 004 — beneficiaries table
-- Run in the Supabase SQL editor. Safe to run more than once.
--
-- Beneficiaries (migrant workers) are a separate stakeholder, not a volunteer
-- with a flag: they have course interests and progress rather than pillars and
-- roles, and their journey is "resume where I left off" rather than "which
-- event shall I sign up for".
--
-- Same intake: one Google Form, split on the "I am a ..." answer. Phone stays
-- the routing key in both tables, and registrations reference it as a plain
-- string, so a beneficiary can RSVP to an event exactly like a volunteer.

create table if not exists beneficiaries (
  id            uuid primary key default gen_random_uuid(),
  -- Digits only, country-code qualified. The WhatsApp routing key.
  phone         text not null unique,
  name          text,
  -- Tamil / Bengali / Mandarin / Malay ... drives which sessions to invite
  -- them to, and in which language to write.
  languages     text[] not null default '{}',
  -- Knowledge-To-Serve courses they're interested in.
  courses       text[] not null default '{}',
  -- Dormitory or region, for transport and venue choice.
  area          text,
  -- "Reminders of where I left off in my educational modules" — shape is
  -- { "<course>": { "module": "...", "updated_at": "..." } }. jsonb rather
  -- than columns because the course list will keep changing.
  course_progress jsonb not null default '{}'::jsonb,
  notes         text,                       -- app-managed; sync never overwrites
  source        text not null default 'form',
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS on, no policies: server-side service_role bypasses it, a leaked anon key
-- reads nothing.
alter table beneficiaries enable row level security;
