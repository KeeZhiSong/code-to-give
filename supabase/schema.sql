-- Passion To Serve — Supabase schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Access model: every query runs SERVER-SIDE from a Next.js route handler using
-- the service_role key, which bypasses RLS. RLS is still enabled on every table
-- so that a leaked anon key can't read volunteer data.
--
-- ⚠️ If you ever query these from the browser with the anon key, you'll get
-- zero rows and NO error until you add policies. That is RLS working, not a bug.

-- ─── Events ──────────────────────────────────────────────────────────────────
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  -- Unique because the app resolves a campaign name to an event id, creating
  -- the row on first use. Keeps today's campaign-string API working unchanged
  -- while making events real records underneath.
  name        text not null unique,
  pillar      text,                       -- Items / Knowledge / Peace
  track       text,                       -- e.g. "AI & Coding"
  starts_at   timestamptz,
  venue       text,
  capacity    int,
  -- The WhatsApp poll question for this event. Responses are matched back to
  -- the event via poll_prompts.stanza_id, not by comparing this text.
  question    text,
  status      text not null default 'planned',   -- planned | open | closed
  created_at  timestamptz not null default now()
);

-- ─── Volunteers ──────────────────────────────────────────────────────────────
-- The Google Form remains the INTAKE (zero build, works on any phone); this
-- table is the source of truth the app reads. `sync_volunteers` pulls new and
-- changed rows across from the published sheet.
--
-- Why not just read the sheet: a published CSV is edge-cached by Google, so a
-- fresh signup can take minutes to appear. It also can't hold anything the app
-- learns later — notes, tags, attendance history.
create table if not exists volunteers (
  id            uuid primary key default gen_random_uuid(),
  -- Digits only, country-code qualified. The routing key for WhatsApp, and
  -- what registrations.phone refers to.
  phone         text not null unique,
  name          text,
  type          text,                       -- Volunteer | Beneficiary
  -- Checkbox answers arrive as lists.
  pillars       text[] not null default '{}',
  roles         text[] not null default '{}',
  notes         text,                       -- app-managed, never overwritten by sync
  source        text not null default 'form',
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists volunteers_type_idx on volunteers (type);

-- ─── Registrations (what data/responses.json holds today) ────────────────────
create table if not exists registrations (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid references events(id) on delete cascade,
  phone       text not null,
  name        text,
  answer      text not null,              -- yes | no
  status      text not null default 'registered',  -- registered|cancelled|attended
  shift       text,
  dietary     text,
  raw         text,                       -- the literal option/text they sent
  created_at  timestamptz not null default now(),
  -- One response per person per event. A changed vote overwrites rather than
  -- appending a second row — this is the upsert target.
  unique (event_id, phone)
);

create index if not exists registrations_event_idx on registrations (event_id);

-- ─── Opt-outs (PDPA: "reply STOP anytime") ───────────────────────────────────
create table if not exists opt_outs (
  phone       text primary key,
  created_at  timestamptz not null default now()
);

-- ─── Poll → event routing ────────────────────────────────────────────────────
-- When a poll is sent we record its message id. Incoming votes carry the same
-- id as pollMessageData.stanzaId, so a vote resolves to an event directly
-- instead of by matching question text (which breaks on any encoding drift).
create table if not exists poll_prompts (
  stanza_id   text primary key,
  event_id    uuid references events(id) on delete cascade,
  intent      text not null default 'invite',   -- invite | shift | dietary | cancel
  created_at  timestamptz not null default now()
);

-- ─── RLS: on, with no policies. Server-side service_role bypasses it. ────────
alter table events        enable row level security;
alter table registrations enable row level security;
alter table opt_outs      enable row level security;
alter table poll_prompts  enable row level security;
alter table volunteers    enable row level security;

-- ─── One event to start, so the console has something to point at ────────────
insert into events (name, pillar, starts_at, venue, capacity, question, status)
select
  'GIFTIK Sunday drive',
  'Items To Serve',
  now() + interval '3 days',
  'Kranji Recreation Centre',
  25,
  'Join Sunday''s GIFTIK distribution drive? 🙌',
  'open'
where not exists (select 1 from events);
