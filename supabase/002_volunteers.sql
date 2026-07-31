-- Migration 002 — volunteers table
-- Run in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to run more than once.
--
-- The Google Form stays the INTAKE; this table becomes the source of truth the
-- app reads. "Sync from form" in the console pulls new and changed rows across.
--
-- Why: a published-to-web CSV is edge-cached by Google, so a fresh signup can
-- take minutes to appear — indistinguishable from a bug. This table is also the
-- only place that can hold what the app learns later (notes, tags, history).

create table if not exists volunteers (
  id            uuid primary key default gen_random_uuid(),
  -- Digits only, country-code qualified. The WhatsApp routing key, and what
  -- registrations.phone refers to.
  phone         text not null unique,
  name          text,
  type          text,                       -- Volunteer | Beneficiary
  -- Checkbox answers arrive as lists.
  pillars       text[] not null default '{}',
  roles         text[] not null default '{}',
  notes         text,                       -- app-managed; sync never overwrites
  source        text not null default 'form',
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists volunteers_type_idx on volunteers (type);

-- RLS on, no policies: server-side service_role bypasses it, a leaked anon key
-- reads nothing.
alter table volunteers enable row level security;
