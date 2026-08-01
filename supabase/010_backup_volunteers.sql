-- Migration 010 — backup volunteers
-- Run in the Supabase SQL editor. Safe to run more than once.
--
-- Tags a volunteer as a standby who's OK being messaged if an event's
-- confirmed headcount falls short close to the day, feeding the automated
-- backup-volunteer alert cron (app/api/cron/backup-alerts).

alter table volunteers add column if not exists is_backup boolean not null default false;
