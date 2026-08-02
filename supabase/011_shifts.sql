-- Volunteer shift coverage.
--
-- A shift is one role, on one day, at one event, with a named primary
-- volunteer and an ordered standby queue behind them. When the primary drops
-- out, the first standby takes the slot.
--
-- The table was created by hand in the Supabase dashboard before this file
-- existed, so this migration is written to be safe to run against a database
-- that already has it — it documents the shape and, more importantly, turns
-- RLS on. Without that, a browser holding only the anon key can read and
-- rewrite every shift assignment, which is what the first version of the
-- dashboard did.

create table if not exists shifts (
  id                bigserial primary key,
  date              date not null,
  event             text not null,
  time              text,
  role              text,
  -- Plain text, not a volunteers FK: shift rosters are drawn up before
  -- everyone has registered, and a name written on a whiteboard has to be
  -- recordable without first creating an account for the person.
  primary_volunteer text,
  -- Ordered standby queue, first in line first. Same reasoning as above.
  standby           text[] not null default '{}',
  -- ok | triggered | covered | open
  status            text not null default 'ok',
  created_at        timestamptz not null default now()
);

create index if not exists shifts_date_idx on shifts (date);

-- RLS on, no policies: the server reads and writes with the service_role key,
-- which bypasses RLS, and a leaked anon key sees nothing. Same model as every
-- other table in this schema.
alter table shifts enable row level security;
