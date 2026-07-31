-- Migration 003 — events_attended on volunteers
-- Run in the Supabase SQL editor. Safe to run more than once.
--
-- A ledger of past events a volunteer has attended, for the loyalty programme.
--
-- Why a stored column rather than deriving it from registrations: registrations
-- only go back as far as this app does, and a loyalty scheme that starts every
-- existing volunteer at zero is worthless on day one. This also lets a credit be
-- a decision ("this one counted") rather than an observation — an RSVP that
-- turned into a no-show shouldn't earn a tier.
--
-- APP-MANAGED: "Sync from form" never writes this column, the same protection
-- `notes` has, so a re-sync can't wipe someone's history.

alter table volunteers
  add column if not exists events_attended text[] not null default '{}';
