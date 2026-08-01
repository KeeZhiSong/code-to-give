-- Migration 009 — on-the-day contact
-- Run in the Supabase SQL editor. Safe to run more than once.
--
-- "Who do I look for when I get there, and who do I call if I'm lost?" is the
-- question a volunteer asks on the morning of an event, and the one thing the
-- invite couldn't answer. It's also what makes the message read as a real
-- briefing from an organisation rather than an automated blast.

alter table events
  add column if not exists contact_name  text,
  add column if not exists contact_phone text;
